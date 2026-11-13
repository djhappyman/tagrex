//! A request-local encoding pool. Strong cached bytes are bounded; a weak
//! index remembers canonical strings still owned by the current plan, so cache
//! eviction never turns shared artwork into N retained base64 allocations.
use base64::Engine as _;
use std::{
    cell::RefCell,
    collections::HashMap,
    hash::{Hash, Hasher},
    sync::{Arc, Weak},
};
type Key = (u64, usize);
type EncodedImage = (Arc<[u8]>, Arc<str>);
type Identity = (Weak<[u8]>, Weak<str>);
const IDENTITY_LIMIT: usize = 256;
const IDENTITY_PRUNE_INTERVAL: usize = 16;
#[derive(Default)]
struct Pool {
    hot: HashMap<Key, Vec<EncodedImage>>,
    weak: HashMap<Key, Vec<Weak<str>>>,
    bytes: usize,
    identity: HashMap<usize, Identity>,
    encodes_since_prune: usize,
}
impl Pool {
    fn encode(&mut self, data: &Arc<[u8]>, limit: usize) -> Arc<str> {
        // Weak slices retain their allocations even after strong owners die.
        // Sweep on a bounded cadence, including identity hits: scanning on
        // every insertion penalizes diverse/tiny artwork and misses hit-only
        // traffic entirely. Dead entries survive at most this many calls (or
        // until Scope drops); this is not a retained-byte budget.
        self.encodes_since_prune += 1;
        if self.encodes_since_prune == IDENTITY_PRUNE_INTERVAL {
            self.identity.retain(|_, (bytes, encoded)| {
                bytes.strong_count() > 0 && encoded.strong_count() > 0
            });
            self.encodes_since_prune = 0;
        }
        let address = Arc::as_ptr(data) as *const u8 as usize;
        if let Some((bytes, encoded)) = self.identity.get(&address) {
            if let Some(bytes) = bytes.upgrade() {
                if Arc::ptr_eq(&bytes, data) {
                    if let Some(encoded) = encoded.upgrade() {
                        return encoded;
                    }
                }
            }
            self.identity.remove(&address);
        }
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        data.hash(&mut hasher);
        let key = (hasher.finish(), data.len());
        if let Some(found) = self.hot.get(&key).and_then(|entries| {
            entries
                .iter()
                .find(|(bytes, _)| bytes.as_ref() == data.as_ref())
        }) {
            let encoded = found.1.clone();
            self.remember_identity(data, &encoded);
            return encoded;
        }
        let found = self.weak.get(&key).and_then(|entries| {
            entries.iter().filter_map(Weak::upgrade).find(|encoded| {
                // Hash narrows the candidates; exact bytes decide identity.
                base64::engine::general_purpose::STANDARD
                    .decode(encoded.as_bytes())
                    .is_ok_and(|bytes| bytes.as_slice() == data.as_ref())
            })
        });
        let encoded = if let Some(found) = found {
            found
        } else {
            let encoded: Arc<str> = base64::engine::general_purpose::STANDARD
                .encode(data)
                .into();
            self.weak
                .entry(key)
                .or_default()
                .push(Arc::downgrade(&encoded));
            encoded
        };
        let cost = data.len().saturating_add(encoded.len());
        if cost <= limit {
            if self.bytes.saturating_add(cost) > limit {
                self.hot.clear();
                self.bytes = 0;
            }
            self.bytes += cost;
            self.hot
                .entry(key)
                .or_default()
                .push((data.clone(), encoded.clone()));
        }
        self.remember_identity(data, &encoded);
        encoded
    }

    fn remember_identity(&mut self, data: &Arc<[u8]>, encoded: &Arc<str>) {
        // A temporary equal-but-separate input should not keep its allocation
        // reserved through a Weak after the caller drops it. Shared inputs (or
        // bytes already owned by the hot cache) are the useful identity case.
        if Arc::strong_count(data) == 1 {
            return;
        }
        if self.identity.len() >= IDENTITY_LIMIT {
            // Dropping this acceleration index cannot affect content matching.
            self.identity.clear();
        }
        // The address only selects a candidate. Upgrading and ptr_eq validate
        // its allocation, so allocator reuse cannot accept a stale entry.
        // Arc::make_mut dissociates Weak pointers (or clones shared bytes),
        // making subsequent edits miss this index and use content matching.
        // Neither weak reference adds to the strong byte budget.
        self.identity.insert(
            Arc::as_ptr(data) as *const u8 as usize,
            (Arc::downgrade(data), Arc::downgrade(encoded)),
        );
    }
}
thread_local! { static POOL: RefCell<Option<Pool>> = const { RefCell::new(None) }; }
pub(crate) struct Scope {
    owns: bool,
}
impl Scope {
    pub fn new() -> Self {
        let owns = POOL.with(|pool| {
            let mut pool = pool.borrow_mut();
            if pool.is_none() {
                *pool = Some(Pool::default());
                true
            } else {
                false
            }
        });
        Self { owns }
    }
}
impl Drop for Scope {
    fn drop(&mut self) {
        if self.owns {
            POOL.with(|pool| {
                pool.borrow_mut().take();
            });
        }
    }
}
pub(crate) fn encode(data: &Arc<[u8]>) -> Arc<str> {
    POOL.with(|pool| match pool.borrow_mut().as_mut() {
        Some(pool) => pool.encode(data, 32 * 1024 * 1024),
        None => base64::engine::general_purpose::STANDARD
            .encode(data)
            .into(),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn evicted_or_oversized_images_reuse_live_plan_strings() {
        let mut pool = Pool::default();
        let first = pool.encode(&Arc::from(vec![1; 1024]), 64);
        for _ in 0..100 {
            let next = pool.encode(&Arc::from(vec![1; 1024]), 64);
            assert!(Arc::ptr_eq(&first, &next));
        }
        assert_eq!(pool.bytes, 0);
        assert!(pool.hot.is_empty());
    }
    #[test]
    fn byte_comparison_rejects_a_deliberately_colliding_candidate() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![1; 100].into();
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        bytes.hash(&mut hash);
        let wrong: Arc<str> = base64::engine::general_purpose::STANDARD
            .encode(vec![2; 100])
            .into();
        pool.weak
            .insert((hash.finish(), bytes.len()), vec![Arc::downgrade(&wrong)]);
        let result = pool.encode(&bytes, 64);
        assert_ne!(result, wrong);
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(result.as_bytes())
                .unwrap(),
            bytes.as_ref()
        );
    }
    fn decoded(encoded: &str) -> Vec<u8> {
        base64::engine::general_purpose::STANDARD
            .decode(encoded.as_bytes())
            .unwrap()
    }

    #[test]
    fn live_identity_survives_eviction_without_content_candidates() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![7; 1024].into();
        let first = pool.encode(&bytes, 4096);
        // Simulate eviction and remove fallback candidates to require the
        // identity path. Clones must still return the original plan string.
        pool.hot.clear();
        pool.bytes = 0;
        pool.weak.clear();
        for _ in 0..100 {
            assert!(Arc::ptr_eq(&first, &pool.encode(&bytes.clone(), 64)));
        }
        assert_eq!(decoded(&first), bytes.as_ref());
        assert_eq!(pool.bytes, 0);
    }

    #[test]
    fn separate_equal_allocations_still_share_canonical_strings() {
        let mut pool = Pool::default();
        let a: Arc<[u8]> = vec![7; 1024].into();
        let b: Arc<[u8]> = vec![7; 1024].into();
        assert!(!Arc::ptr_eq(&a, &b));
        let first = pool.encode(&a, 0);
        let next = pool.encode(&b, 0);
        assert!(Arc::ptr_eq(&first, &next));
        assert!(pool.identity.is_empty());
        let shared = b.clone();
        assert!(Arc::ptr_eq(&first, &pool.encode(&shared, 0)));
        assert_eq!(pool.identity.len(), 1);
        drop(shared);
        assert_eq!(Arc::strong_count(&a), 1);
        assert_eq!(Arc::strong_count(&b), 1);
    }

    #[test]
    fn different_bytes_of_same_length_do_not_alias() {
        let mut pool = Pool::default();
        let a: Arc<[u8]> = vec![1; 1024].into();
        let b: Arc<[u8]> = vec![2; 1024].into();
        let first = pool.encode(&a, 0);
        let next = pool.encode(&b, 0);
        assert!(!Arc::ptr_eq(&first, &next));
        assert_eq!(decoded(&first), a.as_ref());
        assert_eq!(decoded(&next), b.as_ref());
    }

    #[test]
    fn stale_or_wrong_allocation_candidate_is_never_trusted() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![1; 1024].into();
        let other: Arc<[u8]> = vec![2; 1024].into();
        let wrong = pool.encode(&other, 0);
        let address = Arc::as_ptr(&bytes) as *const u8 as usize;
        // Deliberately simulate an address-key collision, both while the old
        // owner is live and after it dies. No allocator timing is required.
        pool.identity
            .insert(address, (Arc::downgrade(&other), Arc::downgrade(&wrong)));
        let first = pool.encode(&bytes, 0);
        assert_eq!(decoded(&first), bytes.as_ref());
        let dead = Arc::downgrade(&other);
        drop(other);
        assert!(dead.upgrade().is_none());
        pool.identity
            .insert(address, (dead, Arc::downgrade(&wrong)));
        assert!(Arc::ptr_eq(&first, &pool.encode(&bytes, 0)));
    }

    #[test]
    fn make_mut_invalidates_identity_for_changed_bytes() {
        let mut pool = Pool::default();
        let mut bytes: Arc<[u8]> = vec![1; 1024].into();
        let shared = bytes.clone();
        let before = pool.encode(&bytes, 0);
        drop(shared);
        assert_eq!(pool.identity.len(), 1);
        let old_owner = Arc::downgrade(&bytes);
        Arc::make_mut(&mut bytes)[0] = 2;
        assert!(old_owner.upgrade().is_none());
        let after = pool.encode(&bytes, 0);
        assert_eq!(decoded(&before), vec![1; 1024]);
        assert_eq!(decoded(&after), bytes.as_ref());
        assert!(!Arc::ptr_eq(&before, &after));
    }

    #[test]
    fn identity_is_bounded_and_prunes_dead_owners() {
        let mut pool = Pool::default();
        let mut keep = Vec::new();
        for i in 0..IDENTITY_LIMIT * 3 {
            let bytes: Arc<[u8]> = (i as u64).to_le_bytes().to_vec().into();
            let shared = bytes.clone();
            let encoded = pool.encode(&shared, 0);
            keep.push((bytes, encoded));
            assert!(pool.identity.len() <= IDENTITY_LIMIT);
        }
        drop(keep);
        for _ in 0..64 {
            let bytes: Arc<[u8]> = vec![5; 16].into();
            pool.encode(&bytes, 0);
        }
        assert!(pool.identity.is_empty());
    }

    #[test]
    fn expired_encoded_string_is_recreated() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![7; 1024].into();
        let first = pool.encode(&bytes.clone(), 0);
        assert_eq!(pool.identity.len(), 1);
        let weak = Arc::downgrade(&first);
        drop(first);
        assert!(weak.upgrade().is_none());
        assert_eq!(decoded(&pool.encode(&bytes, 0)), bytes.as_ref());
    }

    #[test]
    fn identity_hits_prune_dead_bytes_and_dead_strings_within_interval() {
        let mut pool = Pool::default();
        let live: Arc<[u8]> = vec![7; 8].into();
        let first = pool.encode(&live.clone(), 0);
        let dead_bytes: Arc<[u8]> = vec![8; 1024].into();
        let dead_address = Arc::as_ptr(&dead_bytes) as *const u8 as usize;
        let retained_string = pool.encode(&dead_bytes.clone(), 0);
        let retained_bytes: Arc<[u8]> = vec![9; 1024].into();
        let dead_string_address = Arc::as_ptr(&retained_bytes) as *const u8 as usize;
        let dead_string = pool.encode(&retained_bytes.clone(), 0);
        drop(dead_bytes);
        drop(dead_string);
        assert!(pool.identity.contains_key(&dead_address));
        assert!(pool.identity.contains_key(&dead_string_address));
        for _ in 0..IDENTITY_PRUNE_INTERVAL {
            assert!(Arc::ptr_eq(&first, &pool.encode(&live, 0)));
        }
        assert!(!pool.identity.contains_key(&dead_address));
        assert!(!pool.identity.contains_key(&dead_string_address));
        assert_eq!(pool.identity.len(), 1);
        assert_eq!(decoded(&retained_string), vec![8; 1024]);
    }

    #[test]
    fn pruning_keeps_live_shared_and_equal_copy_canonical_strings() {
        let mut pool = Pool::default();
        let live: Arc<[u8]> = vec![7; 8].into();
        let first = pool.encode(&live.clone(), 0);
        for i in 0..IDENTITY_PRUNE_INTERVAL * 3 {
            let bytes: Arc<[u8]> = (i as u64).to_le_bytes().to_vec().into();
            let result = pool.encode(&bytes.clone(), 0);
            assert_eq!(decoded(&result), bytes.as_ref());
            assert!(Arc::ptr_eq(&first, &pool.encode(&live, 0)));
            let equal: Arc<[u8]> = live.as_ref().into();
            assert!(Arc::ptr_eq(&first, &pool.encode(&equal, 0)));
        }
        assert_eq!(pool.bytes, 0);
        assert!(pool.identity.len() <= IDENTITY_LIMIT);
    }

    #[test]
    fn hot_budget_remains_bounded_and_evicted_identity_remains_weak() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![1; 100].into();
        let first = pool.encode(&bytes, 240);
        assert_eq!(pool.bytes, 236);
        let other: Arc<[u8]> = vec![2; 100].into();
        let next = pool.encode(&other, 240);
        assert_eq!(pool.bytes, 236);
        assert_eq!(Arc::strong_count(&bytes), 1);
        assert!(Arc::ptr_eq(&first, &pool.encode(&bytes, 240)));
        assert_eq!(decoded(&next), other.as_ref());
        let oversized: Arc<[u8]> = vec![3; 1024].into();
        let large = pool.encode(&oversized, 240);
        assert_eq!(Arc::strong_count(&oversized), 1);
        assert!(Arc::ptr_eq(&large, &pool.encode(&oversized, 240)));
        assert_eq!(pool.bytes, 236);
    }

    #[test]
    fn transient_equal_inputs_do_not_enter_identity_index() {
        let mut pool = Pool::default();
        let original: Arc<[u8]> = vec![7; 1024].into();
        let first = pool.encode(&original, 4096);
        assert_eq!(pool.identity.len(), 1);
        for _ in 0..100 {
            let transient: Arc<[u8]> = original.as_ref().into();
            let address = Arc::as_ptr(&transient) as *const u8 as usize;
            assert!(Arc::ptr_eq(&first, &pool.encode(&transient, 4096)));
            assert!(!pool.identity.contains_key(&address));
            assert_eq!(pool.identity.len(), 1);
        }
    }

    #[test]
    fn hot_hash_collision_also_requires_exact_bytes() {
        let mut pool = Pool::default();
        let bytes: Arc<[u8]> = vec![1; 100].into();
        let other: Arc<[u8]> = vec![2; 100].into();
        let wrong: Arc<str> = base64::engine::general_purpose::STANDARD
            .encode(&other)
            .into();
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        bytes.hash(&mut hash);
        pool.hot
            .insert((hash.finish(), bytes.len()), vec![(other, wrong.clone())]);
        let result = pool.encode(&bytes, 0);
        assert_ne!(result, wrong);
        assert_eq!(decoded(&result), bytes.as_ref());
    }

    #[test]
    fn nested_scopes_share_only_until_request_owner_drops() {
        let bytes: Arc<[u8]> = vec![1; 100].into();
        let first;
        {
            let _outer = Scope::new();
            first = encode(&bytes);
            {
                let _inner = Scope::new();
                assert!(Arc::ptr_eq(&first, &encode(&bytes)));
            }
            assert!(Arc::ptr_eq(&first, &encode(&bytes)));
        }
        POOL.with(|pool| assert!(pool.borrow().is_none()));
        let _next_request = Scope::new();
        let next = encode(&bytes);
        assert_eq!(first, next);
        assert!(!Arc::ptr_eq(&first, &next));
    }
}

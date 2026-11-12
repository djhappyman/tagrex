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
#[derive(Default)]
struct Pool {
    hot: HashMap<Key, Vec<EncodedImage>>,
    weak: HashMap<Key, Vec<Weak<str>>>,
    bytes: usize,
}
impl Pool {
    fn encode(&mut self, data: &Arc<[u8]>, limit: usize) -> Arc<str> {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        data.hash(&mut hasher);
        let key = (hasher.finish(), data.len());
        if let Some(found) = self.hot.get(&key).and_then(|entries| {
            entries
                .iter()
                .find(|(bytes, _)| bytes.as_ref() == data.as_ref())
        }) {
            return found.1.clone();
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
        encoded
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
}

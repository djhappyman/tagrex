<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
  import { connectControllerSurface } from '$lib/controller-surfaces.js';
  let { id, children }: { id: string; children: Snippet } = $props();
  let open = $state(false);
  let root: HTMLElement;
  function connect(node: HTMLElement) {
    root = node;
    const bridge = connectControllerSurface(root, (value) => { open = value; });
    return { destroy: bridge.destroy };
  }
  function changed(value: boolean) { if (!value && open) root.hidden = true; }
</script>

<div {id} class="ctx-menu controller-popup-root" hidden use:connect>
  <ContextMenu.Root {open} onOpenChange={changed}>
    <ContextMenu.Content forceMount portalProps={{ disabled: true }} class="controller-context-content"
      data-controller-popup loop preventScroll={false} trapFocus={false}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onEscapeKeydown={(event) => event.stopPropagation()}>
      {@render children()}
    </ContextMenu.Content>
  </ContextMenu.Root>
</div>

export function isCellImageInteractionTarget(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => Element | null } | null;
  return !!element?.closest?.('.cell-image, .tabml-image');
}

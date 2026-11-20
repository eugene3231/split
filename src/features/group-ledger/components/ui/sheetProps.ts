/** The `open` and `onOpenChange` of the sheet called `name`, on a screen that shows one sheet at a time. */
export function sheetProps<Name extends string>(
  open: Name | null,
  name: Name,
  setOpen: (next: Name | null) => void,
) {
  return { open: open === name, onOpenChange: (isOpen: boolean) => setOpen(isOpen ? name : null) };
}

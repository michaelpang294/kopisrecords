import { useEffect } from "react";
export default function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const question = () =>
      window.confirm("You have unsaved changes. Leave and discard them?");
    function unload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        !(event.target instanceof window.Element)
      )
        return;
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      const target = new URL(
        anchor.getAttribute("href") || "",
        window.location.href,
      );
      if (target.href !== window.location.href && !question()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function leaving(event: Event) {
      if (!question()) event.preventDefault();
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.addEventListener("admin-before-leave", leaving);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("admin-before-leave", leaving);
    };
  }, [dirty]);
}

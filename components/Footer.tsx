export function Footer() {
  return (
    <footer className="mt-2 rounded-t-[var(--radius-panel)] bg-ink pb-7 pt-14 text-canvas">
      <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-8 px-5 md:px-7">
        <p className="text-xl tracking-tight">11:25 PM. Interview tomorrow?</p>
        <nav aria-label="Footer" className="flex gap-14 text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-[#a8a097]">Prepline</span>
            <a href="#how" className="hover:underline">How it works</a>
            <a href="#prep" className="hover:underline">Prep sheets</a>
            <a href="#features" className="hover:underline">For designers</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[#a8a097]">Company</span>
            <a href="#join" className="hover:underline">Join the beta</a>
            <a href="#join" className="hover:underline">Privacy</a>
          </div>
        </nav>
      </div>
      <div
        aria-hidden
        className="mx-auto mt-12 max-w-[1180px] overflow-hidden px-5 text-[clamp(72px,17vw,240px)] font-semibold leading-[0.85] tracking-[-0.06em] text-[#2b2722] md:px-7"
      >
        Prepline
      </div>
      <div className="mx-auto mt-5 flex max-w-[1180px] flex-wrap justify-between gap-4 px-5 text-[13px] text-[#a8a097] md:px-7">
        <span>© 2026 Prepline</span>
        <span>Made by Jitendra Singh</span>
      </div>
    </footer>
  );
}

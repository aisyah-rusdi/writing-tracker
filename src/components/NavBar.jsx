// The five page links. App renders it twice: once as the top navigation and once as
// the bottom tab bar. CSS shows the top one on wide screens and the bottom one
// below 700px, and the hidden one is not read out by screen readers.
export default function NavBar({ tabs, current, variant = 'top' }) {
  const bottom = variant === 'bottom'
  return (
    <nav className={bottom ? 'tabs' : 'nav-top'} aria-label={bottom ? 'Main, bottom bar' : 'Main'}>
      {tabs.map((t) => (
        <a
          key={t.path}
          href={`#/${t.path}`}
          className={t.path === current ? 'on' : ''}
          aria-current={t.path === current ? 'page' : undefined}
        >
          {t.label}
        </a>
      ))}
    </nav>
  )
}
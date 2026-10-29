export const Logo = ({ light = false }: { light?: boolean }) => (
  <div className={`logo ${light ? 'logo-light' : ''}`}><span className="logo-mark"><span /></span>EVENTIA</div>
)

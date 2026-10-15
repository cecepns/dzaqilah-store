const Header = ({ title, subtitle, right }) => (
  <div className="bg-primary-600 text-white px-4 pt-6 pb-8 rounded-b-3xl">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {typeof title === 'string' ? (
          <h1 className="text-xl font-bold truncate">{title}</h1>
        ) : (
          title
        )}
        {subtitle && (
          <div className="text-primary-100 text-sm mt-0.5 min-w-0">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  </div>
);

export default Header;

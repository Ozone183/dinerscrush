import { Link } from 'react-router-dom';

const Logo = () => {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="relative flex-shrink-0">
        <div className="text-2xl transform group-hover:scale-110 transition-transform duration-300">
          🍽️
        </div>
        <div className="absolute -top-1 -right-1 text-[8px] bg-[#FF6B35] text-white rounded-full w-3 h-3 flex items-center justify-center">
          ⚡
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-0">
          <span className="text-lg font-bold text-[#FF6B35]">Diners</span>
          <span className="text-lg font-bold text-white">Crush</span>
        </div>
        <span className="text-[8px] text-[#4ECDC4] -mt-0.5">Crush Hunger</span>
      </div>
    </Link>
  );
};

export default Logo;
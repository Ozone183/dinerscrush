import { Link } from 'react-router-dom';

const Logo = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div className="relative flex-shrink-0">
        <div className="text-3xl transform group-hover:scale-110 transition-transform duration-300">
          🍽️
        </div>
        <div className="absolute -top-1 -right-2 text-[10px] bg-[#FF6B35] text-white rounded-full w-4 h-4 flex items-center justify-center">
          ⚡
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-0">
          <span className="text-2xl font-bold text-[#FF6B35]">Diners</span>
          <span className="text-2xl font-bold text-white">Crush</span>
        </div>
        <div className="text-[10px] text-[#4ECDC4] -mt-1">Crush Hunger</div>
      </div>
    </Link>
  );
};

export default Logo;
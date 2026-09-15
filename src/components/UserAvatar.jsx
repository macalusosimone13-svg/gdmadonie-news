import { Image } from '@/components/ui/image';
import { User } from 'lucide-react';

export default function UserAvatar({ user, src, size = 40, className = '' }) {
  const fontSize = Math.round(size * 0.4);
  const initial = (user?.full_name || user?.email || 'U').trim().charAt(0).toUpperCase();

  if (src) {
    return (
      <div
        className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <Image src={src} fittingType="fill" alt={user?.full_name || 'Foto profilo'} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {initial || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

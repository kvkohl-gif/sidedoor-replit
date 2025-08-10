import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, HelpCircle, LogOut, ChevronDown, Menu, X } from "lucide-react";

interface UserDropdownProps {
  user: any;
  onLogout: () => void;
  onDashboard?: () => void;
  showDashboard?: boolean;
}

export function UserDropdown({ user, onLogout, onDashboard, showDashboard = false }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.firstName || user?.email?.split('@')[0] || 'User';
  const userInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const menuItems = [
    ...(showDashboard ? [{ icon: User, label: 'Dashboard', action: onDashboard }] : []),
    { icon: User, label: 'Profile', action: () => {} },
    { icon: Settings, label: 'Settings', action: () => {} },
    { icon: HelpCircle, label: 'Help', action: () => {} },
    { icon: LogOut, label: 'Logout', action: onLogout },
  ];

  return (
    <>
      {/* Desktop version */}
      <div className="hidden md:block">
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            className="flex items-center space-x-2 px-3 py-2 h-auto"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            aria-expanded={isOpen}
            aria-haspopup="true"
            data-testid="user-dropdown-trigger"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl} alt={displayName} />
              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-slate-700">{displayName}</span>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>

          {isOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50"
              role="menu"
              aria-orientation="vertical"
              data-testid="user-dropdown-menu"
            >
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  onClick={() => {
                    item.action?.();
                    setIsOpen(false);
                  }}
                  role="menuitem"
                  data-testid={`menu-item-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4 mr-3 text-slate-400" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile hamburger menu */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-label="Open menu"
          data-testid="mobile-menu-trigger"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.profileImageUrl} alt={displayName} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
            </div>
            <div className="py-2">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  className="w-full flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  onClick={() => {
                    item.action?.();
                    setIsMobileMenuOpen(false);
                  }}
                  data-testid={`mobile-menu-item-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4 mr-3 text-slate-400" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
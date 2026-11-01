import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { actionCategories, shopCategories } from './scripts/picksOfTheWeek';

export function MobileCategories() {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  
  return (
    <div className='2xl:hidden w-full bg-black/40 backdrop-blur-md px-5 py-1 flex flex-col'>
      <div 
        className='flex items-center justify-center gap-x-2 cursor-pointer'
        onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
      >
        {categoryDropdownOpen ? <X size={14} /> : <Menu size={14} />}
        <p className='text-sm'>Show Categories</p>
      </div>
      <div
        className={`
          overflow-hidden transition-all duration-400 ease-in-out pb-1
          ${categoryDropdownOpen ? 'max-h-60 opacity-100 mt-3' : 'max-h-0 opacity-0'}
        `}
      >
        <ul className='flex flex-col gap-1 items-center text-sm'>
          {shopCategories.map((cat) => (
            <li key={cat.name}>
              <a href={cat.link} onClick={() => setCategoryDropdownOpen(false)}>
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function MobileActionsCategories() {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(true);
  
  return (
    <div className='2xl:hidden w-full bg-black/40 backdrop-blur-md px-5 py-1 flex flex-col'>
      <div 
        className='flex items-center justify-center gap-x-2 cursor-pointer'
        onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
      >
        {categoryDropdownOpen ? <X size={14} /> : <Menu size={14} />}
        <p className='text-sm'>Show Actions</p>
      </div>
      <div
        className={`
          overflow-hidden transition-all duration-400 ease-in-out pb-1
          ${categoryDropdownOpen ? 'max-h-60 opacity-100 mt-3' : 'max-h-0 opacity-0'}
        `}
      >
        <ul className='flex flex-col gap-1 items-center text-sm'>
          {actionCategories.map((cat) => (
            <li key={cat.name}>
              <a href={cat.link} onClick={() => setCategoryDropdownOpen(false)}>
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function DesktopCategories() {
  return (
    <div className='flex h-12 justify-center justify-between'>
      {shopCategories.map((cat) => (
        <a
          key={cat.name}
          href={cat.link}
          className="px-4 h-full flex items-center hover:bg-white/20 transition-colors duration-150 cursor-pointer"
          >
          {cat.name}
        </a>
      ))}
    </div>
  )
}


import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { actionCategories, shopCategories } from './scripts/picksOfTheWeek';



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


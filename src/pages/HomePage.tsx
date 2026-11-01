import bg1 from '../assets/backgrounds/front-slide-bg.png';
import bg2 from '../assets/backgrounds/second-slide-bg.png';
import bg3 from '../assets/backgrounds/third-slide-bg.png';
import gif1 from '../assets/backgrounds/community.gif';
import { useState } from 'react';
import { picks } from '../scripts/picksOfTheWeek.ts';
import Footer from '../footer.tsx';
import '../App.css';
import NavBar from '../navbar.tsx';
import MobileNavBar from '../mobileNavbar.tsx';

function App() {
  const defaultText = "Hover over an album to see more details.";
  const [description, setDescription] = useState(defaultText);
  return (
    <div className='bg-black'>
      <MobileNavBar />
      <NavBar />
      {/* 1. HERO SLIDE */}
      <section
        className="2xl:min-h-[calc(100vh-80px)] min-h-[calc(100vh-48px)] p-10 bg-cover flex flex-col justify-center text-white"
        style={{ backgroundImage: `url(${bg1})` }}
      >
        <div className="flex flex-col 2xl:items-center">
          <p className='text-6xl 2xl:text-8xl'>Handpicked records with love.</p>
          <p className='mt-10 text-md'>From alternative rock to hip-hop and plenty of gems in between, we stock up on what we love and what you didn’t know you needed yet.</p>
          <p className='mt-4 text-md'>New arrivals every week. Always digging.</p>
          <a 
            className='mt-10 px-20 py-5 bg-[#cbb79c] text-black rounded-full hover:opacity-90 transition text-center text-black hover:cursor-pointer'
            href="/shop"
          >
            <p className='text-md'>Shop Now</p>
          </a>
        </div>
      </section>
      {/* 2. ALBUMS PICKS */}
      <section 
        className="p-10 flex flex-col 2xl:flex-row justify-center 2xl:items-center w-full min-h-screen text-white gap-x-20"
        style={{ backgroundImage: `url(${bg2})` }}
      > 
        <div className='flex-col'>
          <p className='text-2xl 2xl:text-5xl'>Our album picks of the week</p>
          <p className='2xl:mt-3 mb-5'>{description}</p>
        </div>
        <div className='items-center justify-center'>
          <div className='grid grid-cols-4 gap-5 flex 2xl:items-center'>
            {picks.map((album, index) => (
              <div
                key={index}
                onMouseEnter={() => setDescription(album.description)}
                onMouseLeave={() => setDescription(defaultText)}
                className='flex-1 transition-transform duration-300 ease-in-out hover:scale-110 hover:cursor-pointer origin-center'
              >
                <img src={album.image} className='w-60 hover:cursor-pointer' />
                <p className='text-md hover:cursor-pointer'>{album.title}</p>
                <p className='text-sm hover:cursor-pointer'>{album.artist}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* 3. ABOUT US PAGE */}
      <section 
        className='p-10 flex flex-col 2xl:flex-row 2xl:items-center justify-center w-full min-h-screen text-white gap-5'
        style={{backgroundImage: `url(${bg3})`}}
      > 
        <div className=''>
          <p className='text-2xl'>About Us</p>
          <p className='text-md mt-4'>We started our shop just like any other record store. From poor self control and even more impulsive purchases, we fell 
            in love with the hobby and the community around it. We’re just a couple of music lovers, and this store is our way of spreading the love and fun in collecting records. 
            Hopefully, through us you can find your new favourites along the way.
          </p>
          <img src={gif1} className='object-contain mt-4' />
        </div>
      </section>
      <Footer />
    </div>
  )
}

export default App;
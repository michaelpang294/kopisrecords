import ShopDropdown from "./shopDropdown"

export default function NavBar() {
    return (
        <header className="hidden 2xl:flex items-center sticky top-0 justify-between text-white h-20 w-full z-50 bg-black/40 backdrop-blur-md px-8">
          <a href='/'><p className='text-3xl'>Kopi's Records</p></a>
          <ul className="flex gap-4 text-md">
            <li><ShopDropdown /></li>
            <li><a href="#services" className="hover:underline">Request</a></li>
            <li><a href="#cart" className="hover:underline">Cart</a></li>
          </ul>
        </header>
    )
}
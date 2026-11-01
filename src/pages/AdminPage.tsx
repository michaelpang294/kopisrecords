import "../App.css";
import NavBar from "../navbar";
import MobileNavBar from "../mobileNavbar";
import Footer from "../footer";
import bg2 from "../assets/backgrounds/second-slide-bg.png";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CreateProductSection from "../actions/CreateProduct";
import UpdateProductSection from "../actions/UpdateProduct";
import StockLevelsSection from "../actions/StockLevels";
import { actionCategories } from "../scripts/picksOfTheWeek";
import { MobileActionsCategories } from "../categoriesHeader";

function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("admin-auth") === "true",
  );
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { action } = useParams();

  const handleSubmit = () => {
    if (password === "") {
      setIsAuthenticated(true);
      localStorage.setItem("admin-auth", "true"); // ✅ persist
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin-auth");
    setIsAuthenticated(false);
  };

  const renderAction = () => {
    switch (action) {
      case "create":
        return <CreateProductSection />;

      case "edit":
        return <UpdateProductSection />;

      case "stock":
        return <StockLevelsSection />;

      case "sales-recent":
        return <p>Recent Sales</p>;

      case "sales-overview":
        return <p>Sales Overview</p>;

      default:
        return <p className="text-sm">Select an action to begin</p>;
    }
  };

  return (
    <div className="bg-black">
      <MobileNavBar />
      <NavBar />
      <section
        className="2xl:min-h-[calc(100vh-80px)] min-h-[calc(100vh-48px)] flex flex-col text-white"
        style={{ backgroundImage: `url(${bg2})` }}
      >
        {!isAuthenticated ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="bg-black/60 p-6 rounded-md w-full max-w-sm flex flex-col gap-3">
              <p className="2xl:text-xl text-base font-semibold">
                Admin Access
              </p>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="rounded bg-white text-black px-4 2xl:py-1 py-2 font-marcellus placeholder:text-black focus:outline-none 2xl:text-base text-xs"
              />

              <button
                onClick={handleSubmit}
                className="bg-[#cbb79c] text-black py-2 rounded hover:opacity-80 cursor-pointer 2xl:text-base text-xs"
              >
                <p>Enter</p>
              </button>

              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          </div>
        ) : (
          // MAIN CONTENT
          <section className="flex flex-col flex-1">
            <div className="2xl:hidden">
              <MobileActionsCategories />
            </div>
            <div className="flex flex-1 p-2 2xl:p-8 2xl:gap-8 2xl:gap-4">
              {/* LEFT SIDE */}
              <div className="h-full">
                <p className="2xl:text-2xl 2xl:block hidden">
                  Welcome Admin 👋
                </p>

                {/* ACTIONS */}
                <div className="mt-8 2xl:block hidden">
                  <p className="2xl:text-base font-semibold 2xl:text-base text-sm">
                    Actions
                  </p>

                  <ul className="mt-3 space-y-2 text-sm text-gray-300 2xl:text-base text-xs">
                    {actionCategories.map((item) => (
                      <li
                        key={item.name}
                        className="hover:text-white cursor-pointer transition"
                        onClick={() =>
                          item.link === "/admin"
                            ? handleLogout()
                            : navigate(item.link)
                        }
                      >
                        <p>{item.name}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* RIGHT SIDE MAIN CONTENT */}
              <div className="flex-1 bg-black/60 rounded-md p-6">
                {renderAction()}
              </div>
            </div>
          </section>
        )}
      </section>
      <Footer />
    </div>
  );
}

export default AdminPage;

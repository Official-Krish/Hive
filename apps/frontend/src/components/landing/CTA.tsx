import { Link } from "react-router-dom";

export const CTA = () => {
  return (
    <section className="relative bg-[#08090D] select-none overflow-hidden">
      <div
        data-slot="container"
        className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-20 sm:gap-30 pt-16 sm:pt-20 pb-10"
      >
        {/* Top CTA Banner Card */}
        <div className="bg-white/5 border border-white/10 shadow-2xl relative h-96 sm:h-112 overflow-hidden rounded-3xl sm:rounded-4xl">
          {/* Big Background Watermark */}
          <div className="-tracking-widest absolute -bottom-10 sm:top-44 -left-3 justify-start text-[90px] sm:text-[180px] md:text-[240px] lg:text-[300px] leading-none font-medium opacity-25 bg-[linear-gradient(90deg,#FFFFFF_0%,rgba(52,52,52,0)_100%)] bg-clip-text text-transparent pointer-events-none select-none">
            Hive Office
          </div>

          {/* Banner Content */}
          <div className="absolute inset-0 flex h-fit w-full flex-col items-start justify-between px-6 pt-8 sm:pt-10 md:flex-row md:px-12 lg:px-15 md:pt-16 z-10">
            <div className="text-white tracking-tight w-full max-w-xl text-[28px] sm:text-[36px] md:text-5xl md:leading-14 lg:text-[56px] lg:leading-16 font-medium">
              Give Your Team a Place to Build
            </div>

            <div className="inline-flex w-16 flex-col items-start justify-start gap-2.5 py-4 sm:py-6">
              <Link
                className="bg-white shadow-lg inline-flex items-center justify-center gap-2.5 self-stretch rounded-xl px-6 py-3 hover:bg-neutral-200 transition-all hover:scale-105"
                to="/auth"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="scale-150"
                >
                  <path
                    d="M18 8L22 12L18 16"
                    stroke="black"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12H22"
                    stroke="black"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;

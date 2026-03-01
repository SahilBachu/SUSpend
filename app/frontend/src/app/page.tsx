import { redirect } from 'next/navigation';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/50 font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-16 px-6 sm:items-start sm:px-12 sm:py-24 lg:px-16 lg:py-32 bg-white shadow-sm border-x border-zinc-100">
        <Image
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs sm:max-w-md lg:max-w-lg text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-zinc-900">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-xs sm:max-w-md text-base sm:text-lg leading-7 sm:leading-8 text-zinc-500">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col w-full gap-4 text-base font-medium sm:flex-row sm:w-auto mt-8 sm:mt-0">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-white transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] sm:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 px-5 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:scale-[1.02] active:scale-[0.98] sm:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}

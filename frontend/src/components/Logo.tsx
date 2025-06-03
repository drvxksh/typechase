import { Link } from "react-router";

export default function Logo() {
  return (
    <Link
      to="/"
      className="font-logo pointer-cursor text-xl font-bold text-zinc-700 sm:text-2xl"
    >
      Type<span className="text-blue-600">chase</span>
    </Link>
  );
}

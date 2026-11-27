import { Link, type LinkProps } from "react-router";
import useAuth from "@/auth/hooks/useAuth";

/** Authenticated visitors enter the role router; visitors browsing anonymously stay on the public site. */
export default function PublicBrandLink({ to, ...props }: LinkProps) {
  const { user, isLoading, authUnavailable } = useAuth();
  return <Link {...props} to={user || isLoading || authUnavailable ? "/" : to} />;
}

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { CONSULT_PHONE_LABEL, getConsultPhoneTelHref } from "../business";

type PhoneInquiryLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children?: ReactNode;
  fallbackHref?: string;
};

export default function PhoneInquiryLink({
  children = CONSULT_PHONE_LABEL,
  fallbackHref = "/promo/contact",
  onClick,
  ...props
}: PhoneInquiryLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    window.location.href = getConsultPhoneTelHref();
  };

  return (
    <a
      {...props}
      href={fallbackHref}
      onClick={handleClick}
      aria-label={props["aria-label"] ?? "전화 문의하기"}
    >
      {children}
    </a>
  );
}

/* eslint-disable react-refresh/only-export-components */
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      gap={8}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[calc(100vw-32px)] group-[.toaster]:max-w-[420px] group-[.toaster]:rounded-[22px] group-[.toaster]:border group-[.toaster]:border-[#E5EAF1] group-[.toaster]:bg-white/95 group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-[#020617] group-[.toaster]:shadow-[0_18px_44px_rgba(15,23,42,0.18)] group-[.toaster]:backdrop-blur-xl",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-black group-[.toast]:leading-snug group-[.toast]:text-[#020617]",
          description: "group-[.toast]:mt-1 group-[.toast]:text-[12px] group-[.toast]:font-semibold group-[.toast]:leading-relaxed group-[.toast]:text-[#64748B]",
          success: "group-[.toaster]:border-[#22C7A1]/25 group-[.toaster]:bg-[#F2FFFB]/95",
          error: "group-[.toaster]:border-[#FB6B7A]/25 group-[.toaster]:bg-[#FFF5F6]/95",
          actionButton: "group-[.toast]:rounded-full group-[.toast]:bg-[#020617] group-[.toast]:px-3 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:rounded-full group-[.toast]:bg-[#F6F8FB] group-[.toast]:text-[#64748B]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

import { toast } from "react-toastify";

/* Shared notification surface — one look for every toast in the console.
   Styling lives in index.css under the `.Toastify__toast` overrides. */
const defaults = {
  position: "top-right",
  autoClose: 3500,
  closeOnClick: true,
  pauseOnFocusLoss: false,
} as const;

export function notifySuccess(message: string) {
  toast.success(message, defaults);
}

export function notifyError(message: string) {
  toast.error(message, { ...defaults, autoClose: 5000 });
}

export function notifyInfo(message: string) {
  toast.info(message, defaults);
}

import { create } from "zustand";

interface UserStore {
  user: {
    name: string;
    email: string;
    avatar: string;
    plan: "free" | "pro" | "enterprise";
  };
  setUser: (user: UserStore["user"]) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: {
    name: "Rohit Sharma",
    email: "rohit.sharma@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohit",
    plan: "pro",
  },
  setUser: (user) => set({ user }),
}));

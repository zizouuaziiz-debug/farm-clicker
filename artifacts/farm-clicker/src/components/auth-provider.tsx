import React, { createContext, useContext, useEffect, useState } from "react";
import { retrieveLaunchParams } from "@tma.js/sdk";
import {
  useAuthTelegram,
  useGetMe,
  UserProfile,
} from "@/api-client";
import { setAuthTokenGetter } from "@/api-client/custom-fetch";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("farm_clicker_token")
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authTelegram = useAuthTelegram();

  // جلب بيانات المستخدم الحالية من السيرفر
  const { data: freshUser } = useGetMe({
    query: {
      enabled: !!token,
      refetchInterval: 5000, // تحديث كل 5 ثواني
    },
  });

  // تحديث المستخدم عند تغير بيانات السيرفر
  useEffect(() => {
    if (freshUser) {
      setUser(freshUser);
    }
  }, [freshUser]);


  useEffect(() => {
    setAuthTokenGetter(() =>
      localStorage.getItem("farm_clicker_token")
    );

    async function initAuth() {
      try {
        let initData = "";
        let referralCode: string | undefined;

        try {
          const launchParams = retrieveLaunchParams();

          initData =
            (launchParams.initDataRaw as string | undefined) ?? "";

          referralCode = launchParams.startParam;

        } catch {}


        if (!initData) {

          let demoId = localStorage.getItem(
            "farm_clicker_demo_id"
          );

          if (!demoId) {

            demoId = String(
              900000000 +
              Math.floor(Math.random() * 99999999)
            );

            localStorage.setItem(
              "farm_clicker_demo_id",
              demoId
            );
          }


          initData = JSON.stringify({
            id: Number(demoId),
            first_name: "Farmer",
            username: "demo_farmer",
          });
        }


        authTelegram.mutate(
          {
            data: {
              initData,
              referralCode,
            },
          },
          {
            onSuccess: (data) => {

              setToken(data.token);
              setUser(data.user);

              localStorage.setItem(
                "farm_clicker_token",
                data.token
              );

              setAuthTokenGetter(() => data.token);

              setIsLoading(false);
            },

            onError: () => {
              setIsLoading(false);
            },
          }
        );

      } catch {
        setIsLoading(false);
      }
    }


    initAuth();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground">

        <div className="animate-bounce text-6xl mb-4">
          🚜
        </div>

        <h1 className="text-2xl font-display font-bold text-primary animate-pulse">
          Loading Farm...
        </h1>

      </div>
    );
  }



  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export const useAuth = () =>
  useContext(AuthContext);

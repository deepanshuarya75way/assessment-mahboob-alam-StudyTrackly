import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, setAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      navigate("/signin?error=missing_token", { replace: true });
      return;
    }
    const params = new URLSearchParams(hash);
    const takeoverToken = params.get("takeover_token");
    const existingDevice = params.get("existing_device");
    const newDevice = params.get("new_device");
    const token = params.get("token");
    const userRaw = params.get("user");

    // case 1: session conflicts conflict ->  prompt with basic alert/confirm, (removed ui for it)
    if(takeoverToken) {
      const existing = existingDevice ? decodeURIComponent(existingDevice) : "Another Device";
      const current = newDevice ? decodeURIComponent(newDevice) : "This Device";
      
      const shouldTakeover = window.confirm(
        `active session detected \n\nYour account is already active on: \n${existing}\n\nDo you want to take ove the session on ${current}?(this will logout the other device)`
      );
      if(shouldTakeover) {
        api("/api/auth/takeover", {
          method: "POST",
          body: JSON.stringify({takeoverToken }),
        })
        .then((res) => {
          if(res?.token){
            setAuth(res.token, res.user);
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/dashboard", {replace: true});
          } else {
            throw new Error("Missing token in takeover response");
          }  
        })
        .catch((err) => {
          console.log("takeover error",err)
          clearAuth();
          navigate("/signin?error=invalid_callback", {replace: true});
        });
      }else {
        clearAuth();
        navigate("/signin", {replace: true});
      }
      return;
    
    }

    // case 2: Standdrd login taken

    if (!token || !userRaw) {
      navigate("/signin?error=missing_token", { replace: true });
      return;
    }
    // // set token immediatly so user session is authenticated
    // setAuth(token, {email: "student"});
    // window.history.replaceState(null, "", window.location.pathname);


    try {
      const user = JSON.parse(userRaw);
      setAuth(token, user);
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => navigate("/dashboard", { replace: true }));
    } catch {
      navigate("/signin?error=invalid_callback", { replace: true });
    }
    // fetch user setting to populate user info, then route the dashboard

      api("/api/settings", {
      headers: {Authorization: `Bearer ${token}`},
    })
    .then((user) => {
      if(user){
        setAuth(token, user);
      }
    }) 
    .catch((err) => {
      console.warn("could not fetch user setting immideatily", err)
    })
    .finally(() => {
      navigate("/dashboard", {replace: true});
    })
    .catch(() => {
      clearAuth();
      navigate("signin?eror=invalid_callback", {replace: true});
    });

  }, [navigate]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
      Signing you in…
    </div>
  );
}

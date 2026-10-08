import { useSearchParams } from "react-router-dom";
import { getGoogleAuthUrl } from "@/lib/auth";

const errorMessages = {
  oauth_not_configured:
    "Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env (see README), then restart the API.",
  invalid_client:
    "Google rejected the OAuth client (invalid_client). Use a Web application OAuth client from Google Cloud Console, copy the Client ID and Client secret into backend/.env with no extra spaces or quotes, and ensure Authorized redirect URIs includes exactly: http://localhost:4000/api/auth/google/callback (same as GOOGLE_CALLBACK_URL). Then restart the API.",
  redirect_uri_mismatch:
    "Redirect URI mismatch: in Google Cloud → Credentials → your Web client → Authorized redirect URIs, add exactly the same URL as GOOGLE_CALLBACK_URL in backend/.env (copy it from the server log line \"Google OAuth redirect URI\"). Use http://localhost:4000/... not 127.0.0.1 unless you register that too. No extra slash at the end unless you added one in Google.",
  oauth_failed: "Google sign-in failed. Check backend logs and OAuth settings, then try again.",
  missing_code:
    "Google did not return an authorization code. That usually means the consent step did not finish, or redirect settings do not match. Confirm Authorized redirect URI in Google Cloud matches GOOGLE_CALLBACK_URL and try again.",
  invalid_state: "Security check failed. Try signing in again.",
  no_id_token: "Could not verify your Google account. Try again.",
  no_email: "Your Google account has no email. Use a different account.",
  missing_token: "Sign-in was incomplete. Try again.",
  invalid_callback: "Could not complete sign-in. Try again.",
  access_denied: "Sign-in was cancelled.",
  // error code
  session_taken_over: "Your session was ended bcz this account was logged into on another device."
};

export function SignInPage() {
  const [params] = useSearchParams();
  const code = params.get("error");
  const err =
    code && (errorMessages[code] ?? decodeURIComponent(code.replace(/\+/g, " ")));

  const googleHref = getGoogleAuthUrl();

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/studytrackly-logo.svg" alt="StudyTrackly" className="h-12 w-auto" />
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">Use your Google account to continue.</p>

        {err && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        )}

        <div className="mt-8">
          <a
            href={googleHref}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          First time sign-in creates your StudyTrackly account automatically.
        </p>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import FileOrganizer from "../../../index";
import { Notice, TFile, normalizePath } from "obsidian";
import { StyledContainer } from "../../../components/ui/utils";
import { tw } from "../../../lib/utils";
import { obsidianFetch } from "../../../lib/obsidian-fetch";
import { readResponseJson } from "../../../lib/api-json";
import { Inbox } from "../../../inbox";

interface SignupResponse {
  success: boolean;
  licenseKey?: string;
  error?: string;
}

interface OnboardingWizardProps {
  plugin: FileOrganizer;
  /** Which assistant tab to land on: the inbox after a connected account, the organizer (setup prompt) after skipping. */
  onComplete: (tab: "inbox" | "organizer") => void;
}

const SAMPLE_NOTE_NAME = "Sample note - project kickoff.md";
const SAMPLE_NOTE_CONTENT = `Kickoff call with Sam and Priya, Tuesday.

Goal: ship the new onboarding by end of next month.
Sam will draft the user flow, Priya owns the copy.
Open question: do we offer a free tier to new users?
Next check-in: Friday 10am.

Ideas: short welcome video, checklist on first launch, email after day 3.
`;

type Step = "welcome" | "account" | "sample" | "done";

const inputClass =
  "w-full bg-[--background-modifier-form-field] border border-[--background-modifier-border] rounded px-2 py-1 text-[--text-normal]";

export function OnboardingWizard({ plugin, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignup, setIsSignup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async () => {
    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const endpoint = isSignup ? "/api/sign-up" : "/api/sign-in";
      const response = await obsidianFetch(
        `${plugin.getServerUrl()}${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await readResponseJson<SignupResponse>(response);

      if (!data.success || !data.licenseKey) {
        setError(data.error || "Authentication failed");
        return;
      }

      // Store the key first so a retry from the organizer works even if validation fails now
      plugin.settings.API_KEY = data.licenseKey;
      await plugin.saveSettings();

      const isValid = await plugin.isLicenseKeyValid(data.licenseKey);
      if (!isValid) {
        setError(
          "Your account is connected, but we could not verify your license yet. Check your connection and try again."
        );
        return;
      }

      new Notice(
        `Successfully ${isSignup ? "signed up" : "signed in"}! Your account is now connected.`,
        5000
      );
      setStep("sample");
    } catch (err) {
      console.error(`Error during ${isSignup ? "signup" : "login"}:`, err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const markComplete = async () => {
    plugin.settings.hasRunOnboarding = true;
    await plugin.saveSettings();
  };

  const createSampleNote = async () => {
    setIsLoading(true);
    try {
      await plugin.checkAndCreateRequiredFolders();

      const path = normalizePath(
        `${plugin.settings.pathToWatch}/${SAMPLE_NOTE_NAME}`
      );
      const existing = plugin.app.vault.getAbstractFileByPath(path);
      if (!existing) {
        const file = await plugin.app.vault.create(path, SAMPLE_NOTE_CONTENT);
        // The inbox watcher picks up new files when the inbox is on; otherwise queue it directly
        if (!plugin.settings.useInbox && file instanceof TFile) {
          Inbox.getInstance().enqueueFiles([file]);
        }
      }
      await markComplete();
      setStep("done");
    } catch (err) {
      console.error("Failed to create sample note:", err);
      new Notice("Could not create the sample note. You can still add notes to the inbox folder.", 6000);
      await markComplete();
      setStep("done");
    } finally {
      setIsLoading(false);
    }
  };

  const skipAccount = async () => {
    await plugin.checkAndCreateRequiredFolders();
    await markComplete();
    onComplete("organizer");
  };

  return (
    <StyledContainer>
      <div className={tw("w-full max-w-xl mx-auto p-3 text-[--text-normal]")}>
        {step === "welcome" && (
          <div className={tw("space-y-3")}>
            <div
              className={tw(
                "text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase"
              )}
            >
              Welcome to Note Companion
            </div>
            <p className={tw("m-0")}>
              Drop notes in your Inbox and Note Companion files, tags and
              formats them for you.
            </p>
            <ul className={tw("list-disc pl-5 space-y-1 m-0")}>
              <li>Moves each note into the right folder</li>
              <li>Gives each note tags and a clear name</li>
              <li>Works with PDFs and images (voice memos need a paid plan)</li>
            </ul>
            <p className={tw("m-0 text-[--text-muted]")}>
              Create a free account to start. It includes free AI usage, no
              card needed. You can start a 7-day free trial of the full plan
              later.
            </p>
            <button onClick={() => setStep("account")} className="mod-cta w-full">
              Get started
            </button>
          </div>
        )}

        {step === "account" && (
          <div className={tw("space-y-3")}>
            <div
              className={tw(
                "text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase"
              )}
            >
              {isSignup ? "Create your free account" : "Sign in"}
            </div>
            <div
              role="tablist"
              className={tw("flex border-b border-[--background-modifier-border]")}
            >
              {([true, false] as const).map(signupTab => {
                const active = isSignup === signupTab;
                return (
                  <button
                    key={signupTab ? "signup" : "signin"}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setIsSignup(signupTab)}
                    // Inline styles: Obsidian's default button styling overrides utility classes
                    style={{
                      flex: 1,
                      background: "transparent",
                      boxShadow: "none",
                      borderRadius: 0,
                      border: "none",
                      borderBottom: active
                        ? "2px solid var(--interactive-accent)"
                        : "2px solid transparent",
                      color: active
                        ? "var(--text-normal)"
                        : "var(--text-muted)",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {signupTab ? "Sign up" : "Sign in"}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className={tw("text-[--text-error] text-sm")}>{error}</div>
            )}

            <div className={tw("space-y-1")}>
              <label className={tw("block text-sm text-[--text-muted]")}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={tw(inputClass)}
              />
            </div>

            <div className={tw("space-y-1")}>
              <label className={tw("block text-sm text-[--text-muted]")}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={tw(inputClass)}
              />
            </div>

            {isSignup && (
              <div className={tw("space-y-1")}>
                <label className={tw("block text-sm text-[--text-muted]")}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={tw(inputClass)}
                />
              </div>
            )}

            {!isSignup && (
              <p className={tw("m-0 text-xs text-[--text-muted]")}>
                Signed up with Google or another social login? You have no
                password here.{" "}
                <a
                  href="https://app.notecompanion.ai/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the dashboard
                </a>
                , copy your license key, and paste it in Settings → Note
                Companion.
              </p>
            )}

            <button
              onClick={() => {
                void handleAuth();
              }}
              disabled={isLoading}
              className="mod-cta w-full"
            >
              {isLoading ? "Processing..." : isSignup ? "Sign up" : "Sign in"}
            </button>

            <button
              onClick={() => {
                void skipAccount();
              }}
              className={tw("w-full text-sm text-[--text-muted] hover:text-[--text-normal]")}
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "sample" && (
          <div className={tw("space-y-3")}>
            <div
              className={tw(
                "text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase"
              )}
            >
              Try it on a note
            </div>
            <p className={tw("m-0")}>
              You&apos;re connected. We&apos;ll add a short sample note to your
              Inbox so you can watch Note Companion organize it.
            </p>
            <div
              className={tw(
                "border border-[--background-modifier-border] p-2 text-sm"
              )}
            >
              <div className={tw("font-semibold mb-1")}>
                Folders we&apos;ll create:
              </div>
              <div>
                <strong>_NoteCompanion/Inbox</strong>: notes waiting to be
                processed
              </div>
              <div>
                <strong>_NoteCompanion/Processed</strong>: organized notes
              </div>
              <div>
                <strong>_NoteCompanion/References</strong>: reference material
              </div>
            </div>
            <button
              onClick={() => {
                void createSampleNote();
              }}
              disabled={isLoading}
              className="mod-cta w-full"
            >
              {isLoading ? "Setting up..." : "Organize a sample note"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className={tw("space-y-3")}>
            <div
              className={tw(
                "text-[--font-ui-smaller] font-semibold text-[--text-muted] uppercase"
              )}
            >
              Your first note is being organized
            </div>
            <p className={tw("m-0")}>
              Open the Inbox tab to follow its progress. When it finishes,
              you&apos;ll find the note in <strong>_NoteCompanion/Processed</strong>.
              From now on, anything you drop in the Inbox folder is organized
              the same way.
            </p>
            <button onClick={() => onComplete("inbox")} className="mod-cta w-full">
              Open Inbox
            </button>
          </div>
        )}
      </div>
    </StyledContainer>
  );
}

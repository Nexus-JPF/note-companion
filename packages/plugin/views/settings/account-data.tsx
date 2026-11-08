import React, { useState, useEffect } from "react";
import { TopUpCredits } from "./top-up-credits";
import { TopUpMinutes } from "./top-up-minutes";
import { logger } from "../../services/logger";
import FileOrganizer from "../../index";
import { Notice } from "obsidian";
import { validateApiKey } from "../../apiUtils";
import { obsidianFetch } from "../../lib/obsidian-fetch";
import {
  readResponseJson,
  getApiError,
  type ApiErrorBody,
} from "../../lib/api-json";

interface SignupResponse {
  success: boolean;
  licenseKey?: string;
  error?: string;
}

interface HealthResponse {
  environment?: string;
}

interface AccountDataProps {
  plugin: FileOrganizer;
  onLicenseKeyChange: (key: string) => void;
}

export const AccountData: React.FC<AccountDataProps> = ({
  plugin,
  onLicenseKeyChange,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignup, setIsSignup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDevMode, setIsDevMode] = useState(false);
  const [devTokens, setDevTokens] = useState("1000000");
  const [devMinutes, setDevMinutes] = useState("300");

  useEffect(() => {
    // Check if in development mode
    const checkDevMode = async () => {
      try {
        const response = await obsidianFetch(`${plugin.getServerUrl()}/api/health`);
        const data = await readResponseJson<HealthResponse>(response);
        setIsDevMode(data.environment === "development");
      } catch {
        setIsDevMode(false);
      }
    };

    void checkDevMode();
  }, [plugin]);

  const handleSignup = async () => {
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
      const response = await obsidianFetch(`${plugin.getServerUrl()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await readResponseJson<SignupResponse>(response);

      if (!data.success || !data.licenseKey) {
        setError(data.error || "Authentication failed");
        return;
      }

      // Set the license key
      onLicenseKeyChange(data.licenseKey);

      // Show success message
      new Notice(
        `Successfully ${
          isSignup ? "signed up" : "signed in"
        }! Your account is now connected.`,
        5000
      );
    } catch (error) {
      logger.error(`Error during ${isSignup ? "signup" : "login"}:`, error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevTopUp = async () => {
    // Validate API key before making request
    const validation = validateApiKey(plugin.settings.API_KEY);
    if (!validation.isValid) {
      setError(validation.error || "Invalid API key");
      return;
    }

    try {
      setIsLoading(true);
      const tokens = parseInt(devTokens);

      if (isNaN(tokens) || tokens <= 0) {
        setError("Please enter a valid number of tokens");
        return;
      }

      const response = await obsidianFetch(
        `${plugin.getServerUrl()}/api/top-up?tokens=${tokens}`,
        {
          headers: {
            Authorization: `Bearer ${plugin.settings.API_KEY}`,
          },
        }
      );

      const data = await readResponseJson<ApiErrorBody>(response);

      if (response.ok) {
        new Notice(
          `Successfully added ${tokens.toLocaleString()} tokens to your account!`,
          5000
        );
      } else {
        setError(getApiError(data) ?? "Failed to add tokens");
      }
    } catch {
      setError("An error occurred while adding tokens");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevTopUpMinutes = async () => {
    // Validate API key before making request
    const validation = validateApiKey(plugin.settings.API_KEY);
    if (!validation.isValid) {
      setError(validation.error || "Invalid API key");
      return;
    }

    try {
      setIsLoading(true);
      const minutes = parseInt(devMinutes);

      if (isNaN(minutes) || minutes <= 0) {
        setError("Please enter a valid number of minutes");
        return;
      }

      const response = await obsidianFetch(
        `${plugin.getServerUrl()}/api/top-up-minutes?minutes=${minutes}`,
        {
          headers: {
            Authorization: `Bearer ${plugin.settings.API_KEY}`,
          },
        }
      );

      const data = await readResponseJson<ApiErrorBody>(response);

      if (response.ok) {
        new Notice(
          `Successfully added ${minutes} minutes to your account!`,
          5000
        );
      } else {
        setError(getApiError(data) ?? "Failed to add minutes");
      }
    } catch {
      setError("An error occurred while adding minutes");
    } finally {
      setIsLoading(false);
    }
  };

  if (!plugin.settings.API_KEY) {
    return (
      <div className="bg-[--background-primary-alt] p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-2 mt-0">
          Get Started with Note Companion
        </h3>
        <p className="text-[--text-muted] mb-4">
          Create an account or sign in to access all features.
        </p>

        <div className="mb-4 flex items-center justify-center space-x-4">
          <div
            className={`cursor-pointer px-4 py-2 font-medium ${
              isSignup
                ? "text-[--text-accent] border-b-2 border-[--text-accent]"
                : "text-[--text-muted]"
            }`}
            onClick={() => setIsSignup(true)}
          >
            Sign Up
          </div>
          <div
            className={`cursor-pointer px-4 py-2 font-medium ${
              !isSignup
                ? "text-[--text-accent] border-b-2 border-[--text-accent]"
                : "text-[--text-muted]"
            }`}
            onClick={() => setIsSignup(false)}
          >
            Sign In
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[--text-normal] mb-1 text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-[--text-normal] mb-1 text-sm font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
            />
          </div>

          {isSignup && (
            <div>
              <label className="block text-[--text-normal] mb-1 text-sm font-medium">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
              />
            </div>
          )}

          {!isSignup && (
            <p className="text-xs text-[--text-muted]">
              Signed up with Google or another social login? You have no password here.{" "}
              <a href="https://app.notecompanion.ai/dashboard" target="_blank" rel="noopener noreferrer">
                Open the dashboard
              </a>{" "}
              and copy your license key into the License Key field.
            </p>
          )}

          <button
            onClick={() => { void handleSignup(); }}
            disabled={isLoading}
            className="w-full bg-[--interactive-accent] text-[--text-on-accent] py-2 rounded-md font-medium hover:bg-[--interactive-accent-hover] transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : isSignup ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </button>
        </div>

        {/* Create Account via Web */}
        <div className="mb-6">
          <div className="bg-[--background-primary] p-4 rounded-lg border border-[--background-modifier-border]">
            <h4 className="font-medium mb-2 mt-0">Create Account via Web</h4>
            <p className="text-[--text-muted] text-sm mb-4">
              Create an account through our web dashboard for a full-featured
              experience.
            </p>
            <div
              onClick={() => window.open(plugin.getServerUrl(), "_blank")}
              className="cursor-pointer bg-[--interactive-accent] text-[--text-on-accent] px-4 py-2 rounded hover:bg-[--interactive-accent-hover] transition-colors text-center font-medium"
            >
              Open Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center mb-6">
          <div className="flex-grow border-t border-[--background-modifier-border]"></div>
          <span className="mx-4 text-[--text-muted] text-sm">or</span>
          <div className="flex-grow border-t border-[--background-modifier-border]"></div>
        </div>

        {/* Quick Top-up Section */}
        <div className="mb-6">
          <h4 className="font-medium mb-3 mt-0">Quick Top-up</h4>
          <p className="text-[--text-muted] text-sm mb-3">
            Start immediately with a one-time credit purchase. No account
            needed.
          </p>
          <div className="space-y-2">
            <TopUpCredits
              plugin={plugin}
              onLicenseKeyChange={onLicenseKeyChange}
            />
            <TopUpMinutes
              plugin={plugin}
              onLicenseKeyChange={onLicenseKeyChange}
            />
          </div>
        </div>

        {isDevMode && (
          <div className="bg-[--background-primary] p-4 rounded-lg border border-[--background-modifier-border] mt-4">
            <h4 className="font-medium mb-2 mt-0">Development Mode</h4>
            <p className="text-[--text-muted] text-sm mb-3">
              Add tokens or minutes to your account for development purposes.
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={devTokens}
                  onChange={e => setDevTokens(e.target.value)}
                  className="flex-1 bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
                  placeholder="Number of tokens"
                />
                <button
                  onClick={() => { void handleDevTopUp(); }}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Adding..." : "Add Tokens"}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={devMinutes}
                  onChange={e => setDevMinutes(e.target.value)}
                  className="flex-1 bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
                  placeholder="Number of minutes"
                />
                <button
                  onClick={() => { void handleDevTopUpMinutes(); }}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Adding..." : "Add Minutes"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-[--text-muted] text-sm mt-6">
          <p className="mb-2">
            💡 <strong>Benefits of having an account:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Early access to new features</li>
            <li>Credit management dashboard</li>
            <li>Sync across devices</li>
            <li>Priority support</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pt-6">
        <h3 className="text-lg font-medium mb-4 mt-0">Need more credits?</h3>
        <div className="space-y-3">
          <TopUpCredits
            plugin={plugin}
            onLicenseKeyChange={onLicenseKeyChange}
          />
          <TopUpMinutes
            plugin={plugin}
            onLicenseKeyChange={onLicenseKeyChange}
          />
        </div>
      </div>

      {isDevMode && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4 mt-0">Development Tools</h3>
          <div className="bg-[--background-primary] p-4 rounded-lg border border-[--background-modifier-border] space-y-3">
            <div>
              <h4 className="font-medium mb-2 mt-0">Add Development Tokens</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={devTokens}
                  onChange={e => setDevTokens(e.target.value)}
                  className="flex-1 bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
                  placeholder="Number of tokens"
                />
                <button
                  onClick={() => { void handleDevTopUp(); }}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Adding..." : "Add Tokens"}
                </button>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2 mt-0">Add Development Minutes</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={devMinutes}
                  onChange={e => setDevMinutes(e.target.value)}
                  className="flex-1 bg-[--background-primary] border border-[--background-modifier-border] rounded px-3 py-2"
                  placeholder="Number of minutes"
                />
                <button
                  onClick={() => { void handleDevTopUpMinutes(); }}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Adding..." : "Add Minutes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

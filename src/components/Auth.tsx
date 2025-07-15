import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from "@/utils/logging";
import {
  registerUser,
  loginUser,
  initiateOidcLogin,
} from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { AuthResponse } from "../types"; // Import AuthResponse type

const Auth = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  const { loggingLevel } = usePreferences();
  const { signIn } = useAuth(); // Use the useAuth hook (no navigate argument needed here)
  debug(loggingLevel, "Auth: Component rendered.");

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number.";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return "Password must contain at least one special character.";
    }
    return null; // No error
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    info(loggingLevel, "Auth: Attempting sign up.");

    const validationError = validatePassword(password);
    if (validationError) {
      setPasswordError(validationError);
      setLoading(false);
      return;
    } else {
      setPasswordError(null);
    }

    setLoading(true);

    try {
      const data: any = await registerUser(email, password, fullName);
      info(loggingLevel, "Auth: Sign up successful.");
      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      signIn(data.userId, email, data.token, data.role); // Pass token and role to signIn
    } catch (err: any) {
      error(loggingLevel, "Auth: Sign up failed:", err);
      toast({
        title: "Error",
        description:
          err.message || "An unexpected error occurred during sign up.",
        variant: "destructive",
      });
    }

    setLoading(false);
    debug(loggingLevel, "Auth: Sign up loading state set to false.");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    info(loggingLevel, "Auth: Attempting sign in.");
    setLoading(true);

    try {
      const data: any = await loginUser(email, password);
      info(loggingLevel, "Auth: Sign in successful.");
      toast({
        title: "Success",
        description: "Logged in successfully!",
      });
      signIn(data.userId, email, data.token, data.role); // Pass token and role to signIn
    } catch (err: any) {
      error(loggingLevel, "Auth: Sign in failed:", err);
      toast({
        title: "Error",
        description:
          err.message || "An unexpected error occurred during sign in.",
        variant: "destructive",
      });
    }

    setLoading(false);
    debug(loggingLevel, "Auth: Sign in loading state set to false.");
  };

  const handlePasswordReset = async (e: React.MouseEvent) => {
    e.preventDefault();
    info(
      loggingLevel,
      "Auth: Password reset functionality is not yet implemented in the new backend."
    );
    toast({
      title: "Info",
      description: "Password reset functionality is not yet implemented.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md dark:bg-gray-">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/images/SparkyFitness.png"
              alt="SparkyFitness Logo"
              className="h-10 w-10 mr-2"
            />
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-300">
              SparkyFitness
            </CardTitle>
          </div>
          <CardDescription>
            Built for Families. Powered by AI. Track food, fitness, water, and
            health — together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="signin"
                onClick={() =>
                  debug(loggingLevel, "Auth: Switched to Sign In tab.")
                }
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                onClick={() =>
                  debug(loggingLevel, "Auth: Switched to Sign Up tab.")
                }
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      debug(loggingLevel, "Auth: Sign In email input changed.");
                      setEmail(e.target.value);
                    }}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      debug(
                        loggingLevel,
                        "Auth: Sign In password input changed."
                      );
                      setPassword(e.target.value);
                    }}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="text-right text-sm">
                  <a
                    href="#"
                    onClick={handlePasswordReset}
                    className="font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Button
                  type="submit"
                  className="w-full dark:hover:bg-slate-200"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full dark:bg-gray-800 dark:hover:bg-gray-600"
                onClick={initiateOidcLogin}
              >
                Sign In with OIDC
              </Button>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => {
                      debug(
                        loggingLevel,
                        "Auth: Sign Up full name input changed."
                      );
                      setFullName(e.target.value);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      debug(loggingLevel, "Auth: Sign Up email input changed.");
                      setEmail(e.target.value);
                    }}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => {
                      debug(
                        loggingLevel,
                        "Auth: Sign Up password input changed."
                      );
                      setPassword(e.target.value);
                      setPasswordError(validatePassword(e.target.value));
                    }}
                    required
                    autoComplete="new-password"
                  />
                  {passwordError && (
                    <p className="text-red-500 text-sm">{passwordError}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !!passwordError}
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

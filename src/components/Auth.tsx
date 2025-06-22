
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';
import type { User } from '@supabase/supabase-js';

const Auth = () => {
 const { loggingLevel } = usePreferences();
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

   const { data, error: supabaseError } = await supabase.auth.signUp({
     email,
     password,
     options: {
       data: {
         full_name: fullName,
       },
     },
   });

   if (supabaseError) {
     error(loggingLevel, "Auth: Sign up failed:", supabaseError);
     toast({
       title: "Error",
       description: supabaseError.message,
       variant: "destructive",
     });
   } else {
     info(loggingLevel, "Auth: Sign up successful, email confirmation sent.");
     toast({
       title: "Success",
       description: "Check your email for the confirmation link!",
     });
   }

   setLoading(false);
   debug(loggingLevel, "Auth: Sign up loading state set to false.");
 };


 const handleSignIn = async (e: React.FormEvent) => {
   e.preventDefault();
   info(loggingLevel, "Auth: Attempting sign in.");
   setLoading(true);

   const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
     email,
     password,
   });

   if (supabaseError) {
     error(loggingLevel, "Auth: Sign in failed:", supabaseError);
     toast({
       title: "Error",
       description: supabaseError.message,
       variant: "destructive",
     });
   } else {
     info(loggingLevel, "Auth: Sign in successful.");
   }

   setLoading(false);
   debug(loggingLevel, "Auth: Sign in loading state set to false.");
 };

 const handlePasswordReset = async (e: React.MouseEvent) => {
   e.preventDefault();
   info(loggingLevel, "Auth: Attempting password reset.");
   if (!email) {
     toast({
       title: "Error",
       description: "Please enter your email to reset password.",
       variant: "destructive",
     });
     return;
   }

   setLoading(true);
   const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}`, // Redirect to settings page after password reset
   });

   // Always show a success message to prevent email enumeration attacks
   if (supabaseError) {
     warn(loggingLevel, "Auth: Password reset failed (internal error, not shown to user):", supabaseError);
   }
   
   info(loggingLevel, "Auth: Password reset email sent (or attempted).");
   toast({
     title: "Success",
     description: "If an account with that email exists, a password reset link has been sent.",
   });
   
   setLoading(false);
 };

 return (
   <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
     <Card className="w-full max-w-md">
       <CardHeader className="text-center">
         <div className="flex items-center justify-center mb-4">
           <img src="/images/SparkyFitness.png" alt="SparkyFitness Logo" className="h-10 w-10 mr-2" />
           <CardTitle className="text-2xl font-bold text-gray-900">SparkyFitness</CardTitle>
         </div>
         <CardDescription>
           Built for Families. Powered by AI. Track food, fitness, water, and health — together.
         </CardDescription>
       </CardHeader>
       <CardContent>
         <Tabs defaultValue="signin" className="w-full">
           <TabsList className="grid w-full grid-cols-2">
             <TabsTrigger value="signin" onClick={() => debug(loggingLevel, "Auth: Switched to Sign In tab.")}>Sign In</TabsTrigger>
             <TabsTrigger value="signup" onClick={() => debug(loggingLevel, "Auth: Switched to Sign Up tab.")}>Sign Up</TabsTrigger>
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
                     debug(loggingLevel, "Auth: Sign In password input changed.");
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
               <Button type="submit" className="w-full" disabled={loading}>
                 {loading ? "Signing in..." : "Sign In"}
               </Button>
             </form>
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
                     debug(loggingLevel, "Auth: Sign Up full name input changed.");
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
                     debug(loggingLevel, "Auth: Sign Up password input changed.");
                     setPassword(e.target.value);
                     setPasswordError(validatePassword(e.target.value));
                   }}
                   required
                   autoComplete="new-password"
                 />
                 {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
               </div>
               <Button type="submit" className="w-full" disabled={loading || !!passwordError}>
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

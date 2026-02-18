import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <header className="p-6 flex justify-between items-center shadow-sm bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
             <span className="text-white font-bold text-xl">S</span>
           </div>
           <h1 className="text-2xl font-bold text-gray-800">SACVS</h1>
        </div>
        
        <div className="flex gap-4">
          <SignedOut>
            <SignInButton mode="modal">
               <button className="px-4 py-2 text-indigo-600 font-medium hover:text-indigo-800 transition">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
               <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">Get Started</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard" className="mr-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
              Go to Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-4xl mx-auto">
        <h2 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
          Secure Academic Credential <br/>
          <span className="text-indigo-600">Verification System</span>
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl">
          Powered by Blockchain and AI. Issue, verify, and manage academic records with uncompromised security and efficiency.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-10">
           <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto text-blue-600 text-2xl">🎓</div>
              <h3 className="font-bold text-lg mb-2">For Students</h3>
              <p className="text-gray-500 text-sm">Request and track your transcripts and diplomas. Securely share verified credentials.</p>
           </div>
           <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto text-green-600 text-2xl">🏛️</div>
              <h3 className="font-bold text-lg mb-2">For Registrars</h3>
              <p className="text-gray-500 text-sm">Efficiently managing credential issuance. AI-powered verification of request authenticity.</p>
           </div>
           <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition">
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto text-purple-600 text-2xl">🛡️</div>
              <h3 className="font-bold text-lg mb-2">Blockchain Security</h3>
              <p className="text-gray-500 text-sm">Tamper-proof records anchored on the blockchain. Immutable and transparent history.</p>
           </div>
        </div>
      </main>
      
      <footer className="p-6 text-center text-gray-400 text-sm">
        © 2026 SACVS. All rights reserved.
      </footer>
    </div>
  );
}
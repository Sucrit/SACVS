import { Link } from "react-router-dom";

export default function Unauthorized() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
            <p className="text-gray-600 mb-8">You do not have permission to access this page.</p>
            <Link to="/" className="text-indigo-600 hover:underline">Go back home</Link>
        </div>
    )
}
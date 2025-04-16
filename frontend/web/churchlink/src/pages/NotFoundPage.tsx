import React from "react";

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center bg-gray-100">
      <h1 className="text-5xl font-bold text-red-500 mb-4">404</h1>
      <p className="text-xl text-gray-800">Oops! The page you are looking for doesn't exist.</p>
    </div>
  );
};

export default NotFoundPage;
import React from "react";

const InConstructionPage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center bg-yellow-50">
      <h1 className="text-4xl font-bold text-yellow-600 mb-4">🚧 Page Under Construction</h1>
      <p className="text-lg text-yellow-800 max-w-xl">
        This page exists but it's currently hidden from public view. Please check back later or contact the administrator if you believe this is a mistake.
      </p>
    </div>
  );
};

export default InConstructionPage;


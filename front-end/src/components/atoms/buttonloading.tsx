export default function ButtonLoading() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="bg-white h-2.5 w-2.5 animate-bounce rounded-full [animation-delay:-0.3s]" ></div>
      <div className="bg-white h-2.5 w-2.5 animate-bounce rounded-full [animation-delay:-0.13s]"></div>
      <div className="bg-white h-2.5 w-2.5 animate-bounce rounded-full"></div>
    </div>
  );
}

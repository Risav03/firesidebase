export default function Background() {
    return (
        <div className="h-screen-real bg-black fixed inset-0">
            <div className="h-[200px] w-[50%] left-1/2 rounded-full bg-orange-500 absolute -bottom-40 blur-[200px] bg-float-1"></div>

            <div className="h-[400px] w-screen rounded-full bg-orange-800/50 absolute -bottom-60 blur-[150px] bg-float-2"></div>
        </div>
    )
}
export default function Home() {
  return (
    <main>
      <h1 className='text-3xl font-bold text-center'>Welcome to Ember Web Configuration</h1>
      <div className='flex-initial h-32 w-full'>
        <p className='text-2xl text-center'>connect the keyboard </p>
      </div>
      <div className='flex flex-col'>
        <div className='flex-initial h-32 w-full'>
          <h2 className='text-2xl text-center'>Key Mapping</h2>
        </div>
        <div className='flex-initial h-32 w-full'>
          <h2 className='text-2xl text-center'>Calibration</h2>
        </div>
        <div className='flex-initial h-32 w-full'>
          <h2 className='text-2xl text-center'>Rapid Trigger</h2>
        </div>
      </div>
    </main>
  );
}

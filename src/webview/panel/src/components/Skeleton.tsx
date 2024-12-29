export const Skeleton = () => {
  const lineCount = Math.floor(Math.random() * (2 - 1 + 1)) + 1;
  return (
    <div style={{ width: '80%', textAlign: 'left', marginTop: '1rem' }}>
      {Array.from({ length: lineCount }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height: '16px',
            marginBottom: '4px',
            borderRadius: '4px',
            width: `${Math.random() * (80 - 30) + 30}%`,
          }}
        />
      ))}
    </div>
  );
};

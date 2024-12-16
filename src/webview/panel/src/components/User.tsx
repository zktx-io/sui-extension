export const User = ({ data }: { data: string }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-foreground)',
          padding: '10px 15px',
          borderRadius: '15px',
          textAlign: 'left',
          position: 'relative',
          boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.2)',
        }}
      >
        {data}
      </div>
    </div>
  );
};

interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0' }}>
      <span
        style={{
          background: 'rgba(0,0,0,0.05)',
          borderRadius: '12px',
          padding: '4px 14px',
          fontSize: '12px',
          color: '#8A94A6',
          fontWeight: 500,
        }}
      >
        {date}
      </span>
    </div>
  );
}
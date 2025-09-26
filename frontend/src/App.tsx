import FormComponent from './components/form.component';

function App() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <FormComponent
        onSubmit={(value) => console.log('Form submitted with value:', value)}
      />
    </div>
  );
}

export default App;

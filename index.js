import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App);
// Garantiza que la aplicacion se registre tanto en Expo Go como en Development Builds nativas
registerRootComponent(App);

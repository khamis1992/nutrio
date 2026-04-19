import { setupIonicReact, IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';

// Import Ionic CSS
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

// Optional CSS utils
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

// Theme variables
import './ionic-variables.css';

// Setup Ionic with React
setupIonicReact({
  mode: 'ios', // Use iOS mode for consistent look across platforms
  swipeBackEnabled: true,
  animated: true,
});

interface IonicProviderProps {
  children: React.ReactNode;
}

export const IonicProvider: React.FC<IonicProviderProps> = ({ children }) => {
  return (
    <IonApp>
      {children}
    </IonApp>
  );
};

export { IonReactRouter, IonRouterOutlet, Route };

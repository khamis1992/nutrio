import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { arrowBack, close } from 'ionicons/icons';
import { useCapacitor } from '@/hooks/useCapacitor';

interface IonicPageWrapperProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  rightButtons?: React.ReactNode;
  hideHeader?: boolean;
  className?: string;
  fullscreen?: boolean;
}

export const IonicPageWrapper: React.FC<IonicPageWrapperProps> = ({
  children,
  title,
  showBackButton = false,
  showCloseButton = false,
  onClose,
  rightButtons,
  hideHeader = false,
  className = '',
  fullscreen = false,
}) => {
  const { isNative } = useCapacitor();

  return (
    <IonPage className={className}>
      {!hideHeader && (
        <IonHeader className="ion-no-border" mode="ios">
          <IonToolbar mode="ios">
            <IonButtons slot="start">
              {showBackButton && (
                <IonBackButton
                  defaultHref="/"
                  icon={arrowBack}
                  text=""
                  mode="ios"
                />
              )}
              {showCloseButton && onClose && (
                <IonButton onClick={onClose} mode="ios">
                  <IonIcon icon={close} slot="icon-only" />
                </IonButton>
              )}
            </IonButtons>

            {title && <IonTitle>{title}</IonTitle>}

            {rightButtons && (
              <IonButtons slot="end">{rightButtons}</IonButtons>
            )}
          </IonToolbar>
        </IonHeader>
      )}

      <IonContent
        fullscreen={fullscreen}
        className={fullscreen ? 'ion-padding' : ''}
        scrollY={true}
        scrollX={false}
      >
        {/* Safe area padding for notched devices */}
        <div className="ion-safe-area-top" />
        
        <div className={fullscreen ? '' : 'ion-padding'}>
          {children}
        </div>
        
        {/* Bottom safe area padding */}
        <div className="ion-safe-area-bottom pb-20" />
      </IonContent>
    </IonPage>
  );
};

export default IonicPageWrapper;

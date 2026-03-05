import React, { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonDatetime,
  IonModal,
  IonList,
  IonSearchbar,
  IonChip,
  IonBadge,
  IonText,
  IonRippleEffect,
} from '@ionic/react';
import {
  busOutline,
  timeOutline,
  locationOutline,
  navigateOutline,
  swapVerticalOutline,
  calendarOutline,
  arrowForwardOutline,
  pricetagOutline,
  walkOutline,
  informationCircleOutline,
  searchOutline,
  closeOutline,
  locateOutline,
  chevronDownOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import { fetchStations, fetchDepartures, fetchStops, Station, Departure, Stop } from '../services/arrivaApi';
import './Home.css';

const NOMINATIM_USER_AGENT = 'ArrivaVozniRed/1.0';
const GEOLOCATION_TIMEOUT_MS = 10000;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}. ${month}. ${year}`;
}

const Home: React.FC = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState('');

  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  const [departures, setDepartures] = useState<Departure[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStations()
      .then((s) => setStations(s))
      .catch(() => setStationsError('Napaka pri nalaganju postaj.'))
      .finally(() => setStationsLoading(false));
  }, []);

  const swapStations = () => {
    setFromStation(toStation);
    setToStation(fromStation);
  };

  const handleSearch = async () => {
    if (!fromStation || !toStation) return;
    setSearching(true);
    setSearchError('');
    setHasSearched(true);
    setExpandedIdx(null);
    try {
      const results = await fetchDepartures(fromStation.id, toStation.id, selectedDate);
      setDepartures(results);
      if (results.length === 0) setSearchError('Ni odhodov za izbrano relacijo in datum.');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      setSearchError('Napaka pri iskanju odhodov. Poskusite znova.');
      setDepartures([]);
    } finally {
      setSearching(false);
    }
  };

  const handleNearestStation = () => {
    if (!navigator.geolocation) {
      setLocationError('Vaša naprava ne podpira geolokacije.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          setLocationError('Neveljavne koordinate lokacije.');
          setLocating(false);
          return;
        }
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'sl', 'User-Agent': NOMINATIM_USER_AGENT } }
          );
          const geo = await res.json();
          const addr = geo.address ?? {};
          const locality: string =
            addr.suburb ?? addr.village ?? addr.town ?? addr.city ?? addr.municipality ?? '';
          if (!locality) {
            setLocationError('Ne morem določiti vaše lokacije.');
            setLocating(false);
            return;
          }
          const locLower = locality.toLowerCase();
          const matches = stations.filter((s) =>
            s.name.toLowerCase().startsWith(locLower)
          );
          if (matches.length === 0) {
            setLocationError(`Ni postaj v kraju "${locality}".`);
            setLocating(false);
            return;
          }
          const best =
            matches.find(
              (s) =>
                s.name.toLowerCase().includes(' ap') ||
                s.name.toLowerCase().includes('avtobusna')
            ) ?? matches[0];
          setFromStation(best);
          setLocationError('');
        } catch {
          setLocationError('Napaka pri iskanju lokacije.');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Dostop do lokacije zavrnjen.');
        } else {
          setLocationError('Napaka pri pridobivanju lokacije.');
        }
      },
      { timeout: GEOLOCATION_TIMEOUT_MS }
    );
  };

  return (
    <IonPage>
      <IonHeader className="arriva-header">
        <IonToolbar className="arriva-toolbar">
          <div className="header-content">
            <div className="logo-container">
              <div className="logo-icon">
                <IonIcon icon={busOutline} />
              </div>
              <div className="logo-text">
                <span className="logo-arriva">arriva</span>
                <span className="logo-subtitle">vozni red</span>
              </div>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="arriva-content">
        {/* Hero search section */}
        <div className="hero-section">
          <div className="hero-bg" />
          <div className="search-container">
            <h2 className="search-title">Poiščite avtobusni prevoz</h2>

            <div className="search-card">
              {/* From station */}
              <div className="from-row">
                <div
                  className="station-selector ion-activatable"
                  onClick={() => setShowFromModal(true)}
                >
                  <IonRippleEffect />
                  <div className="station-icon from-icon">
                    <IonIcon icon={locationOutline} />
                  </div>
                  <div className="station-info">
                    <span className="station-label">Od</span>
                    <span className={`station-name ${!fromStation ? 'placeholder' : ''}`}>
                      {fromStation ? fromStation.name : 'Izberite začetno postajo'}
                    </span>
                  </div>
                  <IonIcon icon={searchOutline} className="station-arrow" />
                </div>
                <button
                  className="locate-btn ion-activatable"
                  onClick={handleNearestStation}
                  disabled={locating || stationsLoading}
                  aria-label="Poišči najbližjo postajo"
                >
                  <IonRippleEffect />
                  {locating
                    ? <IonSpinner name="crescent" className="locate-spinner" />
                    : <IonIcon icon={locateOutline} />
                  }
                </button>
              </div>
              {locationError && (
                <div className="error-msg location-error">
                  <IonIcon icon={informationCircleOutline} />
                  <span>{locationError}</span>
                </div>
              )}

              {/* Swap button */}
              <div className="swap-divider">
                <div className="divider-line" />
                <button
                  className="swap-btn ion-activatable"
                  onClick={swapStations}
                  disabled={!fromStation && !toStation}
                >
                  <IonRippleEffect />
                  <IonIcon icon={swapVerticalOutline} />
                </button>
                <div className="divider-line" />
              </div>

              {/* To station */}
              <div
                className="station-selector ion-activatable"
                onClick={() => setShowToModal(true)}
              >
                <IonRippleEffect />
                <div className="station-icon to-icon">
                  <IonIcon icon={navigateOutline} />
                </div>
                <div className="station-info">
                  <span className="station-label">Do</span>
                  <span className={`station-name ${!toStation ? 'placeholder' : ''}`}>
                    {toStation ? toStation.name : 'Izberite končno postajo'}
                  </span>
                </div>
                <IonIcon icon={searchOutline} className="station-arrow" />
              </div>

              {/* Date picker */}
              <div className="date-divider" />
              <div
                className="date-selector ion-activatable"
                onClick={() => setShowDateModal(true)}
              >
                <IonRippleEffect />
                <div className="station-icon date-icon">
                  <IonIcon icon={calendarOutline} />
                </div>
                <div className="station-info">
                  <span className="station-label">Datum</span>
                  <span className="station-name">{formatDisplayDate(selectedDate)}</span>
                </div>
              </div>

              {/* Search button */}
              <IonButton
                expand="block"
                className="search-btn"
                onClick={handleSearch}
                disabled={!fromStation || !toStation || searching || stationsLoading}
              >
                {searching ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <>
                    <IonIcon slot="start" icon={searchOutline} />
                    Poišči odhode
                  </>
                )}
              </IonButton>

              {stationsError && (
                <div className="error-msg">
                  <IonIcon icon={informationCircleOutline} />
                  <span>{stationsError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results section */}
        <div ref={resultsRef} className="results-section">
          {hasSearched && (
            <>
              {searchError && !searching && (
                <div className="no-results">
                  <IonIcon icon={busOutline} className="no-results-icon" />
                  <p>{searchError}</p>
                </div>
              )}

              {!searching && departures.length > 0 && (
                <>
                  <div className="results-header">
                    <h3 className="results-title">
                      {fromStation?.name}
                      <IonIcon icon={arrowForwardOutline} className="results-arrow" />
                      {toStation?.name}
                    </h3>
                    <IonChip className="results-chip">
                      <IonIcon icon={calendarOutline} />
                      <IonLabel>{formatDisplayDate(selectedDate)}</IonLabel>
                    </IonChip>
                    <IonBadge className="results-count">{departures.length} odhodov</IonBadge>
                  </div>

                  <div className="departure-list">
                    {departures.map((dep, idx) => (
                      <DepartureCard
                        key={idx}
                        departure={dep}
                        isExpanded={expandedIdx === idx}
                        onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {!hasSearched && (
            <div className="empty-state">
              <IonIcon icon={busOutline} className="empty-icon" />
              <p>Izberite postaji in datum ter kliknite Poišči odhode.</p>
            </div>
          )}
        </div>

        {/* Station picker modals */}
        <StationPickerModal
          isOpen={showFromModal}
          title="Začetna postaja"
          stations={stations}
          loading={stationsLoading}
          onSelect={(s) => { setFromStation(s); setShowFromModal(false); }}
          onClose={() => setShowFromModal(false)}
        />
        <StationPickerModal
          isOpen={showToModal}
          title="Končna postaja"
          stations={stations}
          loading={stationsLoading}
          onSelect={(s) => { setToStation(s); setShowToModal(false); }}
          onClose={() => setShowToModal(false)}
        />

        {/* Date modal */}
        <IonModal isOpen={showDateModal} onDidDismiss={() => setShowDateModal(false)} className="date-modal">
          <div className="date-modal-content">
            <div className="modal-header">
              <h3>Izberite datum</h3>
              <button className="modal-close" onClick={() => setShowDateModal(false)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            <IonDatetime
              value={selectedDate}
              presentation="date"
              onIonChange={(e) => {
                const val = e.detail.value;
                if (typeof val === 'string') setSelectedDate(val.split('T')[0]);
                setShowDateModal(false);
              }}
              min={todayISO()}
              className="arriva-datetime"
            />
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

/* ---------- Departure Card ---------- */
interface DepartureCardProps {
  departure: Departure;
  isExpanded: boolean;
  onToggle: () => void;
}

const DepartureCard: React.FC<DepartureCardProps> = ({ departure, isExpanded, onToggle }) => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState('');
  const [stopsAttempted, setStopsAttempted] = useState(false);

  useEffect(() => {
    if (isExpanded && !stopsAttempted && departure.spodSif) {
      setStopsAttempted(true);
      setStopsLoading(true);
      fetchStops(departure.spodSif, departure.zapZ, departure.zapK)
        .then(setStops)
        .catch(() => setStopsError('Vmesne postaje niso na voljo.'))
        .finally(() => setStopsLoading(false));
    }
  }, [isExpanded, stopsAttempted, departure.spodSif, departure.zapZ, departure.zapK]);

  return (
    <IonCard
      className={`departure-card${isExpanded ? ' departure-card--expanded' : ''}`}
      onClick={onToggle}
    >
      <IonCardContent className="departure-card-content">
        {/* Times row */}
        <div className="times-row">
          <div className="time-block">
            <span className="time-label">Odhod</span>
            <span className="time-value depart">{departure.departureTime}</span>
          </div>
          <div className="duration-block">
            <div className="duration-line">
              <div className="line-dot start-dot" />
              <div className="line-track" />
              <div className="line-dot end-dot" />
            </div>
            <span className="duration-text">
              <IonIcon icon={timeOutline} />
              {departure.durationMinutes} min
            </span>
          </div>
          <div className="time-block">
            <span className="time-label">Prihod</span>
            <span className="time-value arrive">{departure.arrivalTime}</span>
          </div>
          <IonIcon
            icon={isExpanded ? chevronUpOutline : chevronDownOutline}
            className="card-chevron"
          />
        </div>

        {/* Details row */}
        <div className="details-row">
          {departure.routeName && (
            <div className="detail-item">
              <IonIcon icon={busOutline} />
              <span>{departure.routeName}</span>
            </div>
          )}
          {departure.distanceKm > 0 && (
            <div className="detail-item">
              <IonIcon icon={walkOutline} />
              <span>{departure.distanceKm} km</span>
            </div>
          )}
          {departure.price > 0 && (
            <div className="detail-item price">
              <IonIcon icon={pricetagOutline} />
              <span>{departure.price.toFixed(2)} €</span>
            </div>
          )}
        </div>

        {departure.note && (
          <div className="note-row">
            <IonIcon icon={informationCircleOutline} />
            <IonText color="medium"><small>{departure.note}</small></IonText>
          </div>
        )}

        {/* Expandable stops section */}
        {isExpanded && (
          <div className="stops-section" onClick={(e) => e.stopPropagation()}>
            <div className="stops-divider" />
            <span className="stops-title">Vmesne postaje</span>
            {stopsLoading && (
              <div className="stops-loading">
                <IonSpinner name="crescent" />
                <span>Nalaganje postaj...</span>
              </div>
            )}
            {!stopsLoading && stopsError && (
              <div className="stops-message">
                <IonIcon icon={informationCircleOutline} />
                <span>{stopsError}</span>
              </div>
            )}
            {!stopsLoading && !stopsError && stops.length === 0 && stopsAttempted && (
              <div className="stops-message">
                <IonIcon icon={informationCircleOutline} />
                <span>Vmesne postaje niso na voljo.</span>
              </div>
            )}
            {!stopsLoading && stops.length > 0 && (
              <div className="stops-list">
                {stops.map((stop, i) => {
                  const classes = [
                    'stop-item',
                    i === 0 ? 'stop-item--first' : '',
                    i === stops.length - 1 ? 'stop-item--last' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <div key={i} className={classes}>
                      <span className="stop-time">{stop.time}</span>
                      <div className="stop-connector">
                        <div className="stop-dot" />
                        {i < stops.length - 1 && <div className="stop-line" />}
                      </div>
                      <span className="stop-name">{stop.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

/* ---------- Station Picker Modal ---------- */
interface StationPickerModalProps {
  isOpen: boolean;
  title: string;
  stations: Station[];
  loading: boolean;
  onSelect: (s: Station) => void;
  onClose: () => void;
}

const StationPickerModal: React.FC<StationPickerModalProps> = ({
  isOpen,
  title,
  stations,
  loading,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? stations.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
      )
    : stations.slice(0, 100); // Show first 100 when no query

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="station-modal">
      <div className="station-modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <IonIcon icon={closeOutline} />
          </button>
        </div>
        <IonSearchbar
          value={query}
          onIonInput={(e) => setQuery(e.detail.value ?? '')}
          placeholder="Iščite postaje..."
          className="station-search"
          animated
        />
        {loading ? (
          <div className="loading-stations">
            <IonSpinner name="crescent" />
            <p>Nalaganje postaj...</p>
          </div>
        ) : (
          <IonList className="station-list" lines="full">
            {filtered.length === 0 ? (
              <IonItem>
                <IonLabel color="medium">Ni rezultatov za &ldquo;{query}&rdquo;</IonLabel>
              </IonItem>
            ) : (
              filtered.map((s) => (
                <IonItem
                  key={s.id}
                  button
                  detail={false}
                  onClick={() => { onSelect(s); setQuery(''); }}
                  className="station-item ion-activatable"
                >
                  <IonIcon slot="start" icon={locationOutline} className="station-list-icon" />
                  <IonLabel>{s.name}</IonLabel>
                </IonItem>
              ))
            )}
          </IonList>
        )}
      </div>
    </IonModal>
  );
};

export default Home;

import { createThemedStyles, useThemedStyles } from '../../theme/ThemeContext';

/** Estilos compartidos por los modales (fondo, caja de aviso, botones) */
const themed = createThemedStyles({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  box: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: '#0B131E',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 16,
  },
  boxError: {
    borderColor: '#FF2A4B',
  },
  boxSuccess: {
    borderColor: '#00E5FF',
  },
  header: {
    marginBottom: 8,
  },
  badge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  badgeError: {
    color: '#FF2A4B',
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  messageText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  confirmBtn: {
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnError: {
    backgroundColor: '#FF2A4B',
  },
  confirmBtnText: {
    color: '#090E17',
    fontSize: 10,
    fontWeight: '900',
  },
});

export const useModalStyles = () => useThemedStyles(themed);

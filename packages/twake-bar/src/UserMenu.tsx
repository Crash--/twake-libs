import React from 'react'

import {
  CloudRainbow,
  FromUser,
  Icon,
  Logout,
  Right
} from '@linagora/twake-icons'
import {
  Avatar,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Typography,
  getInitials,
  nameToColor,
  styled,
  useBreakpoints
} from '@linagora/twake-mui'
import type { Instance, Sdk } from '@linagora/twake-sdk'
import { useI18n } from 'twake-i18n'

import { BarMenu } from './BarMenu'
import { useSdk } from './SdkProvider'
import { formatAvailableGigabytes } from './helpers'
import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

const SETTINGS_SLUG = 'settings'

/** The user off the platform, from the host's SSO */
export interface BarFallbackUser {
  name: string
  email: string
}

interface UserMenuData {
  instance: Instance | null
  profileURL: string | null
  storageURL: string | null
  /** The email domain is active once a mail app is installed */
  isEmailDomainActive: boolean
}

// Each part can be refused to the app: the menu keeps what it gets, and the
// log out in any case
const orNull = <T,>(promise: Promise<T>): Promise<T | null> =>
  promise.catch(() => null)

const loadUserMenu = async (sdk: Sdk): Promise<UserMenuData> => {
  const [instance, apps, profileURL, storageURL] = await Promise.all([
    orNull(sdk.getInstance()),
    orNull(sdk.getApps()),
    orNull(sdk.getAppURL(SETTINGS_SLUG, '#/profile')),
    orNull(sdk.getAppURL(SETTINGS_SLUG, '#/storage'))
  ])
  return {
    instance,
    profileURL,
    storageURL,
    // Unknown apps: no warning either
    isEmailDomainActive:
      !instance?.org_id ||
      apps === null ||
      apps.some(app => app.slug.includes('mail'))
  }
}

const avatarURL = (sdk: Sdk): string =>
  `${sdk.platformURL}/public/avatar?fallback=initials`

const Content = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.up('md')]: { width: 320 }
}))

// Same metrics as cozy-bar: 32px avatar, 48px entries, 16px icon gutter
const Identity = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 8px 0',
  textAlign: 'center',
  '& .MuiAvatar-root': { marginBottom: 8 },
  '& .MuiTypography-root': { maxWidth: '100%' }
})

const Entries = styled(MenuList)(({ theme }) => ({
  padding: '8px 0 0',
  '& .MuiMenuItem-root': {
    minHeight: 48,
    padding: '8px 16px',
    borderRadius: 0,
    fontSize: 16
  },
  // The 16px icon gutter is the gap of the twake-mui MenuItem
  '& .MuiMenuItem-root .MuiListItemIcon-root': {
    minWidth: 32,
    color: theme.vars.palette.text.secondary
  },
  '& .MuiMenuItem-root.withEndIcon': { paddingRight: 8 },
  '& .MuiDivider-root.MuiDivider-inset': { margin: '0 0 0 64px' }
}))

const Centered = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  marginTop: theme.spacing(1)
}))

const LogOutItem = ({
  onClick
}: {
  onClick: () => void
}): React.ReactElement => {
  const { t } = useI18n()

  return (
    <MenuItem onClick={onClick} data-testid="twake-bar-logout">
      <ListItemIcon>
        <Icon icon={Logout} />
      </ListItemIcon>
      <ListItemText primary={t('twakeBar.logOut')} />
    </MenuItem>
  )
}

export interface UserMenuProps {
  onLogOut: () => void
  showEmailDomainChip?: boolean
}

interface UserMenuContentProps extends UserMenuProps {
  data: UserMenuData
  close: () => void
}

const UserMenuContent = ({
  data,
  onLogOut,
  showEmailDomainChip,
  close
}: UserMenuContentProps): React.ReactElement => {
  const sdk = useSdk()
  const { t } = useI18n()
  const { instance, profileURL, storageURL, isEmailDomainActive } = data

  const handleLogOut = (): void => {
    close()
    onLogOut()
  }

  return (
    <Content data-testid="twake-bar-user-menu">
      <Identity>
        <Avatar size={32} src={avatarURL(sdk)} />
        <Typography variant="h4" noWrap>
          {instance?.public_name}
        </Typography>
        <Typography variant="body2" noWrap>
          {instance?.email}
        </Typography>
      </Identity>
      {showEmailDomainChip && !isEmailDomainActive && (
        <Centered>
          <Chip
            size="small"
            color="warning"
            label={t('twakeBar.emailDomainNotActive')}
          />
        </Centered>
      )}
      <Entries>
        {profileURL && (
          <MenuItem component="a" href={profileURL} onClick={close}>
            <ListItemIcon>
              <Icon icon={FromUser} />
            </ListItemIcon>
            <ListItemText primary={t('twakeBar.manageProfile')} />
          </MenuItem>
        )}
        {storageURL && instance?.diskUsage !== null && instance && (
          <MenuItem
            component="a"
            href={storageURL}
            onClick={close}
            className="withEndIcon"
          >
            <ListItemIcon>
              <Icon icon={CloudRainbow} />
            </ListItemIcon>
            <ListItemText
              primary={t('twakeBar.storage')}
              secondary={`${formatAvailableGigabytes(
                instance.diskUsage,
                instance.diskQuota
              )} ${t('twakeBar.gbAvailable')}`}
              slotProps={{ secondary: { variant: 'caption' } }}
            />
            <ListItemIcon>
              <Icon icon={Right} />
            </ListItemIcon>
          </MenuItem>
        )}
        <Divider component="li" variant="inset" />
        <LogOutItem onClick={handleLogOut} />
      </Entries>
    </Content>
  )
}

export const UserMenu = ({
  onLogOut,
  showEmailDomainChip = true
}: UserMenuProps): React.ReactElement => {
  useBarLocales()
  const sdk = useSdk()
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { data } = useSdkData(loadUserMenu)

  return (
    <BarMenu
      label={t('twakeBar.userMenu')}
      disabled={!data}
      trigger={<Avatar size={isMobile ? 24 : 32} src={avatarURL(sdk)} />}
      data-testid="twake-bar-user-button"
    >
      {close =>
        data && (
          <UserMenuContent
            data={data}
            onLogOut={onLogOut}
            showEmailDomainChip={showEmailDomainChip}
            close={close}
          />
        )
      }
    </BarMenu>
  )
}

const FallbackAvatar = ({
  user,
  size
}: {
  user?: BarFallbackUser
  size: number
}): React.ReactElement => (
  <Avatar size={size} color={nameToColor(user?.name)}>
    {user ? getInitials(user.name, user.email) : null}
  </Avatar>
)

/**
 * The account off the platform: the user given by the host, when there is
 * one, and the log out in any case
 */
export const FallbackUserMenu = ({
  user,
  onLogOut
}: {
  user?: BarFallbackUser
  onLogOut: () => void
}): React.ReactElement => {
  useBarLocales()
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()

  return (
    <BarMenu
      label={t('twakeBar.userMenu')}
      trigger={<FallbackAvatar user={user} size={isMobile ? 24 : 32} />}
      data-testid="twake-bar-user-button"
    >
      {close => (
        <Content data-testid="twake-bar-user-menu">
          {user && (
            <Identity>
              <FallbackAvatar user={user} size={32} />
              <Typography variant="h4" noWrap>
                {user.name}
              </Typography>
              <Typography variant="body2" noWrap>
                {user.email}
              </Typography>
            </Identity>
          )}
          <Entries>
            <LogOutItem
              onClick={() => {
                close()
                onLogOut()
              }}
            />
          </Entries>
        </Content>
      )}
    </BarMenu>
  )
}

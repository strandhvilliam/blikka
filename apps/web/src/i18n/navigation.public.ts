import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing.public"

const { Link, usePathname } = createNavigation(routing)

export const PublicNavigation = {
  Link,
  usePathname,
}

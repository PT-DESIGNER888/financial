import {
  Injectable,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /** ผู้ใช้อยู่ใน DB ล้วนๆ ไม่ผูกกับ env — สตาร์ทครั้งแรก (ตารางว่าง)
   *  seed เจ้าของระบบ admin/admin1234 แล้วให้เปลี่ยนรหัสในหน้าตั้งค่า
   *  (ถ้าลืมรหัส: ลบแถวในตาราง users แล้ว restart ระบบจะ seed ให้ใหม่) */
  async onApplicationBootstrap() {
    if ((await this.users.count()) > 0) return;
    await this.users.save(
      this.users.create({
        username: 'admin',
        passwordHash: await bcrypt.hash('admin1234', 10),
        displayName: 'เจ้าของระบบ',
        role: 'OWNER',
      }),
    );
    console.warn(
      '[auth] สร้างผู้ใช้เริ่มต้น admin/admin1234 — เข้าระบบแล้วเปลี่ยนรหัสผ่านทันทีที่หน้าตั้งค่า',
    );
  }

  /** เปลี่ยนรหัสผ่าน — ตรวจรหัสเดิมก่อน */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('รหัสผ่านเดิมไม่ถูกต้อง');
    }
    if (newPassword.length < 6) {
      throw new UnauthorizedException('รหัสใหม่ต้องอย่างน้อย 6 ตัว');
    }
    await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, 10),
    });
    return { ok: true };
  }

  async login(username: string, password: string) {
    const user = await this.users.findOneBy({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('บัญชีนี้ถูกระงับการใช้งาน');
    }
    await this.users.update(user.id, {
      lastLoginAt: new Date().toISOString(),
    });
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.users.findOneByOrFail({
        id: payload.sub,
        isActive: true,
      });
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('refresh token ไม่ถูกต้องหรือหมดอายุ');
    }
  }

  verifyAccess(token: string) {
    return this.jwt.verifyAsync(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  private async issueTokens(user: User) {
    // role ติดไปใน token เผื่ออนาคตมี STAFF แล้วต้องคุมสิทธิ์
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '1d',
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      }),
    };
  }
}
